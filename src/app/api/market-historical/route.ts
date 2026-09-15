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
// Fichero OMIE por día: https://www.omie.es/es/file-download?parents=marginalpdbc&filename=marginalpdbc_YYYYMMDD.N
// (N = 1, 2 o 3: se prueba en ese orden, OMIE deja solo la última versión publicada)
// CSV formato: Año;Mes;Día;Periodo;Precio Portugal;Precio España;  (€/MWh)
// Se lee la columna 5 (España). La 4 es Portugal: coinciden casi siempre (MIBEL
// acoplado) pero se separan cuando se congestiona la interconexión. Ver ADR-0012.
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

  try {
    // Cuando OMIE republica un día retira la versión .1 y deja la .2 (o .3):
    // 2025-11-27 da 404 en .1 y existe en .2. Ver ADR-0012.
    let text: string | null = null
    for (const version of [1, 2, 3]) {
      const filename = `marginalpdbc_${y}${m}${d}.${version}`
      const res = await fetch(`https://www.omie.es/es/file-download?parents=marginalpdbc&filename=${filename}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 86400 }, // cachear 24h — datos históricos no cambian
      })
      if (res.ok && !res.headers.get('content-type')?.includes('html')) {
        text = await res.text()
        break
      }
    }
    if (!text) return []

    // La columna 4 es el INDICE de periodo dentro del dia, no la hora directamente:
    // 1-24/25 en el formato horario legado, o 1-92/96/100 en el formato de cuarto de
    // hora (MTU 15 min) que usa OMIE desde oct-2025. Hay que derivar la hora real a
    // partir del numero de filas del propio dia, no asumir 1-24 a ciegas.
    const filas: { indice: number; precio: number }[] = []
    for (const linea of text.split('\n')) {
      const partes = linea.replace(/,/g, '.').split(';')
      if (partes.length >= 6) {
        const indice = parseInt(partes[3])
        const precio = parseFloat(partes[5])  // España, €/MWh — puede ser negativo (excedente solar)
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
  const cups = searchParams.get('cups')

  if (!start || !end) {
    return NextResponse.json({ error: 'Parámetros start y end requeridos (YYYY-MM-DD)' }, { status: 400 })
  }

  // Acumulador de precios por periodo. Se guarda precio y peso (kWh consumidos en esa
  // hora) para poder devolver la media PONDERADA cuando hay curva del cliente — que es
  // lo que hacen de verdad las dos comercializadoras. Ver ADR-0010:
  //   Próxima: "PMD: precio marginal del mercado diario en el CUARTO DE HORA
  //             correspondiente publicado por OMIE (MARGINALPDBC)"
  //   Total JAZZ: "Σ(OMIEh × Di + CMFi + ATRe)", OMIEh horario "para cada hora"
  // Sin curva, peso = 1 en todas las horas y el resultado es la media aritmética de
  // siempre — misma respuesta que antes, marcada como estimación.
  const porPeriodo: Partial<Record<Periodo, { precio: number; peso: number }[]>> = {}

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

  // Curva horaria real del CUPS, si la hay. Es lo que convierte la media en ponderada.
  // La tabla va por cups_id (ADR-0001), así que primero se resuelve el código.
  const pesos = new Map<string, number>()   // "YYYY-MM-DD|hora" -> kWh
  if (cups && supabase) {
    const { data: filaCups } = await supabase
      .from('cups').select('id').eq('codigo', cups).maybeSingle()
    if (filaCups) {
      // Paginado: un rango de un año son ~8.760 filas y PostgREST corta en 1.000.
      for (let desde = 0; ; desde += 1000) {
        const { data } = await supabase
          .from('consumos_datadis_horario')
          .select('fecha, hora, kwh')
          .eq('cups_id', filaCups.id)
          .gte('fecha', start).lte('fecha', end)
          .range(desde, desde + 999)
        if (!data?.length) break
        for (const r of data) pesos.set(`${r.fecha}|${r.hora}`, Number(r.kwh))
        if (data.length < 1000) break
      }
    }
  }

  const fechasFaltantes = fechas.filter(f => !porFecha.has(fechaKey(f)))
  const resultadosOmie = await Promise.all(fechasFaltantes.map(f => fetchOmieDia(f)))
  fechasFaltantes.forEach((f, i) => {
    if (resultadosOmie[i].length > 0) porFecha.set(fechaKey(f), resultadosOmie[i])
  })

  // Solo se pondera si la curva cubre casi todo el rango: con cobertura parcial la
  // media ponderada sale sesgada hacia los días que sí están, que es peor que la
  // aritmética. Por debajo del umbral se ignora la curva por completo.
  const COBERTURA_MINIMA = 0.95
  let horasConCurva = 0, horasTotales = 0

  for (const fecha of fechas) {
    const datos = porFecha.get(fechaKey(fecha))
    if (!datos || datos.length === 0) continue
    diasOk++
    for (const { hora, precio } of datos) {
      horasTotales++
      if (pesos.has(`${fechaKey(fecha)}|${hora}`)) horasConCurva++
    }
  }
  const cobertura = horasTotales > 0 ? horasConCurva / horasTotales : 0
  const ponderado = pesos.size > 0 && cobertura >= COBERTURA_MINIMA

  for (const fecha of fechas) {
    const datos = porFecha.get(fechaKey(fecha))
    if (!datos || datos.length === 0) continue
    for (const { hora, precio } of datos) {
      const p = getPeriodo(fecha, hora, tarifa, zona)
      if (!porPeriodo[p]) porPeriodo[p] = []
      porPeriodo[p]!.push({
        precio,
        peso: ponderado ? (pesos.get(`${fechaKey(fecha)}|${hora}`) ?? 0) : 1,
      })
    }
  }

  if (diasOk === 0) {
    return NextResponse.json({ error: 'OMIE no disponible para ese rango', _fallback: true }, { status: 200 })
  }

  // Media por periodo (€/MWh), ponderada por consumo si hay curva.
  // Si un periodo tiene curva pero consumo cero (ej. un bar que no consume de
  // madrugada), el peso total es 0 y no hay media ponderada posible: se cae a la
  // aritmética de ese periodo en vez de devolver NaN.
  const pmd: Partial<Record<Periodo, number>> = {}
  for (const [periodo, vals] of Object.entries(porPeriodo) as [Periodo, { precio: number; peso: number }[]][]) {
    const pesoTotal = vals.reduce((s, v) => s + v.peso, 0)
    const media = pesoTotal > 0
      ? vals.reduce((s, v) => s + v.precio * v.peso, 0) / pesoTotal
      : vals.reduce((s, v) => s + v.precio, 0) / vals.length
    pmd[periodo] = Math.round(media * 100) / 100
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
    // Con qué base se ha calculado. 'curva_real' es el método que usan de verdad las
    // comercializadoras; 'media_aritmetica' es la estimación de siempre, y hay que
    // marcarla como tal igual que ya se hace con el origen del PERD.
    metodo: ponderado ? 'curva_real' : 'media_aritmetica',
    cobertura_curva: Math.round(cobertura * 1000) / 1000,
    _source: 'omie_marginalpdbc',
    _zona: zona,
    _rango: { start, end },
  })
}
