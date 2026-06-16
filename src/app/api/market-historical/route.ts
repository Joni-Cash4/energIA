import { NextRequest, NextResponse } from 'next/server'
import { HORAS_PERIODO, normalizaTarifa, type Periodo } from '@/lib/market-rates'

// Devuelve el PMD (precio mercado diario OMIE) medio por periodo tarifario
// para el RANGO EXACTO de fechas de una factura — no el precio de hoy.
// Fuente: apidatos.ree.es (pública, sin token), igual fuente que market-hourly.
//
// GET /api/market-historical?start=2026-03-21&end=2026-03-31&tarifa=3.0TD

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const tarifa = normalizaTarifa(searchParams.get('tarifa'))

  if (!start || !end) {
    return NextResponse.json({ error: 'Parámetros start y end requeridos (YYYY-MM-DD)' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?time_trunc=hour&start_date=${start}T00:00&end_date=${end}T23:59&geo_trunc=electric_system&geo_limit=peninsular&geo_ids=8741`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 3600 } }
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'REE API no disponible', _fallback: true }, { status: 200 })
    }

    const json = await res.json()
    const values: { value: number; datetime: string }[] = json?.included?.[0]?.attributes?.values ?? []

    if (values.length === 0) {
      return NextResponse.json({ error: 'Sin datos para ese rango', _fallback: true }, { status: 200 })
    }

    // Agrupar por hora del día (0-23), acumulando todos los días del rango
    const porHora: number[][] = Array.from({ length: 24 }, () => [])
    for (const v of values) {
      const d = new Date(v.datetime)
      const hora = d.getHours()
      porHora[hora].push(v.value) // €/MWh
    }

    const horasPeriodo = HORAS_PERIODO[tarifa]
    const pmd: Partial<Record<Periodo, number>> = {}
    for (const [periodo, horas] of Object.entries(horasPeriodo) as [Periodo, number[]][]) {
      const vals = horas.flatMap((h) => porHora[h] ?? [])
      pmd[periodo] = vals.length > 0
        ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100 // €/MWh
        : 0
    }

    // 3.0TD/6.1TD: P3,P4,P5 no tienen horas propias mapeadas -> usar valor de P6 (valle)
    if (tarifa === '3.0TD' || tarifa === '6.1TD') {
      const valle = pmd.P6 ?? pmd.P3 ?? 0
      for (const p of ['P3', 'P4', 'P5'] as Periodo[]) {
        if (!pmd[p]) pmd[p] = valle
      }
    }

    const media = Object.values(pmd).reduce((s, v) => s + (v ?? 0), 0) / Object.values(pmd).length

    return NextResponse.json({
      pmd_por_periodo_mwh: pmd, // €/MWh
      media_mwh: Math.round(media * 100) / 100,
      dias_encontrados: Math.round(values.length / 24),
      _source: 'ree_datos_historico',
      _rango: { start, end },
    })
  } catch (err) {
    console.error('[market-historical]', err)
    return NextResponse.json({ error: 'Error al obtener histórico de mercado', _fallback: true }, { status: 200 })
  }
}
