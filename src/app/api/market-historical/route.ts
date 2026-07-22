import { NextRequest, NextResponse } from 'next/server'
import { normalizaTarifa, type Periodo } from '@/lib/market-rates'
import { getPeriodo, type Zona } from '@/lib/periodos'
import { getSupabaseServerClient } from '@/lib/supabase-server'

// Devuelve el PMD (precio marginal diario OMIE) promedio por periodo tarifario
// para el RANGO EXACTO de fechas de una factura.
//
// Fuente principal: tabla Supabase mercado_pmd_diario, sincronizada a diario desde
// el sistema Python local de Jonathan (ver sync_pmd_diario.py en
// C:\MonitorizacionEnergetica\sistema\) — Vercel llamando a OMIE en directo fallaba
// a veces porque OMIE bloquea/rate-limita IPs de datacenter, lo que disparaba el
// aviso de "estimación". Solo se llama a OMIE en directo (fetchOmieDia) como red de
// seguridad para días que aún no estén en Supabase (ej. factura de ayer mismo, antes
// de que corra la sincronización diaria).
//
// Fichero OMIE por día: https://www.omie.es/es/file-download?parents=marginalpdbc&filename=marginalpdbc_YYYYMMDD.1
// CSV formato: Año;Mes;Dia;Hora(1-24);Precio(€/MWh);PrecioUnidad
//
// GET /api/market-historical?start=2026-03-01&end=2026-03-31&tarifa=3.0TD[&zona=CANARIAS]


function fechaKey(fecha: Date): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function fetchOmieDia(fecha: Date): Promise<{ hora: number; precio: number }[]> {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  const filename = `marginalpdbc_${y}${m}${d}.1`
  const url = `https://www.omie.es/es/file-download?parents=marginalpdbc&filename=${filename}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 86400 }, // cachear 24h — datos históricos no cambian
    })
    if (!res.ok || res.headers.get('content-type')?.includes('html')) return []
    const text = await res.text()

    // La columna 4 es el INDICE de periodo dentro del dia, no la hora directamente:
    // 1-24/25 en el formato horario legado, o 1-92/96/100 en el formato de cuarto de
    // hora (MTU 15 min) que usa OMIE desde oct-2025. Hay que derivar la hora real a
    // partir del numero de filas del propio dia, no asumir 1-24 a ciegas.
    const filas: { indice: number; precio: number }[] = []
    for (const linea of text.split('\n')) {
      const partes = linea.replace(/,/g, '.').split(';')
      if (partes.length >= 5) {
        const indice = parseInt(partes[3])
        const precio = parseFloat(partes[4])  // €/MWh — puede ser negativo (excedente solar)
        if (!isNaN(indice) && !isNaN(precio) && indice >= 1 && precio >= -500 && precio <= 3000) {
          filas.push({ indice, precio })
        }
      }
    }
    if (filas.length === 0) return []

    const cuartosPorHora = Math.max(1, Math.round(filas.length / 24)) // 1 legado, 4 MTU 15 min
    const resultado = filas.map(({ indice, precio }) => ({
      hora: Math.min(23, Math.floor((indice - 1) / cuartosPorHora)),
      precio,
    }))
    return resultado
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const tarifa = normalizaTarifa(searchParams.get('tarifa'))
  const zonaParam = searchParams.get('zona')
  const zona: Zona = (zonaParam === 'CANARIAS' || zonaParam === 'BALEARES') ? zonaParam : 'PENINSULA'

  if (!start || !end) {
    return NextResponse.json({ error: 'Parámetros start y end requeridos (YYYY-MM-DD)' }, { status: 400 })
  }

  // Acumulador de precios por periodo: { P1: [€/MWh, ...], ... }
  const porPeriodo: Partial<Record<Periodo, number[]>> = {}

  const fechaInicio = new Date(start + 'T00:00:00')
  const fechaFin    = new Date(end   + 'T23:59:59')
  let diasOk = 0

  const fechas: Date[] = []
  const cur = new Date(fechaInicio)
  while (cur <= fechaFin) {
    fechas.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }

  // Fuente principal: Supabase (sincronizado a diario desde OMIE por el sistema
  // Python local — ver comentario arriba). Agrupamos por fecha para saber qué
  // días faltan y solo pedir esos a OMIE en directo.
  const porFecha = new Map<string, { hora: number; precio: number }[]>()
  const supabase = getSupabaseServerClient()
  if (supabase) {
    const { data } = await supabase
      .from('mercado_pmd_diario')
      .select('fecha, hora, precio_mwh')
      .gte('fecha', start)
      .lte('fecha', end)
    for (const row of data ?? []) {
      const lista = porFecha.get(row.fecha) ?? []
      lista.push({ hora: row.hora, precio: row.precio_mwh })
      porFecha.set(row.fecha, lista)
    }
  }

  const fechasFaltantes = fechas.filter(f => !porFecha.has(fechaKey(f)))
  const resultadosOmie = await Promise.all(fechasFaltantes.map(f => fetchOmieDia(f)))
  fechasFaltantes.forEach((f, i) => {
    if (resultadosOmie[i].length > 0) porFecha.set(fechaKey(f), resultadosOmie[i])
  })

  for (const fecha of fechas) {
    const datos = porFecha.get(fechaKey(fecha))
    if (!datos || datos.length === 0) continue
    diasOk++
    for (const { hora, precio } of datos) {
      const p = getPeriodo(fecha, hora, tarifa, zona)
      if (!porPeriodo[p]) porPeriodo[p] = []
      porPeriodo[p]!.push(precio)
    }
  }

  if (diasOk === 0) {
    return NextResponse.json({ error: 'OMIE no disponible para ese rango', _fallback: true }, { status: 200 })
  }

  // Promediar por periodo (€/MWh)
  const pmd: Partial<Record<Periodo, number>> = {}
  for (const [periodo, vals] of Object.entries(porPeriodo) as [Periodo, number[]][]) {
    pmd[periodo] = Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
  }

  // Rellenar periodos sin datos con el valor del periodo valle disponible más cercano
  // (ej. cliente que no consume de noche → P4/P5 pueden estar vacíos para esa temporada)
  if (tarifa === '3.0TD') {
    const fallback = pmd.P6 ?? pmd.P5 ?? pmd.P4 ?? pmd.P3 ?? 0
    for (const p of ['P1','P2','P3','P4','P5','P6'] as Periodo[]) {
      if (!pmd[p]) pmd[p] = fallback
    }
  }

  const periodoVals = Object.values(pmd).filter((v): v is number => v !== undefined)
  const media = periodoVals.length > 0
    ? Math.round(periodoVals.reduce((s, v) => s + v, 0) / periodoVals.length * 100) / 100
    : 0

  return NextResponse.json({
    pmd_por_periodo_mwh: pmd,
    media_mwh: media,
    dias_encontrados: diasOk,
    dias_total: fechas.length,
    _source: 'omie_marginalpdbc',
    _zona: zona,
    _rango: { start, end },
  })
}
