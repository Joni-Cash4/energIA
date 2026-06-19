import { NextRequest, NextResponse } from 'next/server'
import { normalizaTarifa, type Periodo } from '@/lib/market-rates'
import { getPeriodo, type Zona } from '@/lib/periodos'

// Devuelve el PMD (precio marginal diario OMIE) promedio por periodo tarifario
// para el RANGO EXACTO de fechas de una factura.
//
// Fuente: OMIE MARGINALPDBC (público, sin token) — mismo método que el sistema Python.
// Fichero por día: https://www.omie.es/es/file-download?parents=marginalpdbc&filename=marginalpdbc_YYYYMMDD.1
// CSV formato: Año;Mes;Dia;Hora(1-24);Precio(€/MWh);PrecioUnidad
//
// GET /api/market-historical?start=2026-03-01&end=2026-03-31&tarifa=3.0TD[&zona=CANARIAS]


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
    const resultado: { hora: number; precio: number }[] = []
    for (const linea of text.split('\n')) {
      const partes = linea.replace(/,/g, '.').split(';')
      if (partes.length >= 5) {
        const hora = parseInt(partes[3]) - 1 // OMIE usa horas 1-24 → 0-23
        const precio = parseFloat(partes[4])  // €/MWh
        if (!isNaN(hora) && !isNaN(precio) && hora >= 0 && hora <= 23 && precio >= 0 && precio <= 2000) {
          resultado.push({ hora, precio })
        }
      }
    }
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

  // Descargar OMIE día a día en paralelo (máx. 31 peticiones)
  const fechas: Date[] = []
  const cur = new Date(fechaInicio)
  while (cur <= fechaFin) {
    fechas.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }

  const resultados = await Promise.all(fechas.map(f => fetchOmieDia(f)))

  for (let i = 0; i < fechas.length; i++) {
    const datos = resultados[i]
    if (datos.length === 0) continue
    diasOk++
    const fecha = fechas[i]
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
