import { NextResponse } from 'next/server'
import type { HourlyPrice, MarketHourlyResponse } from '@/types'

export const revalidate = 3600

function percentile(sorted: number[], p: number): number {
  const idx = Math.floor(sorted.length * p)
  return sorted[Math.min(idx, sorted.length - 1)]
}

// ESIOS `datetime` is always in Spain local time: "2024-01-15T01:00:00.000+01:00"
// Using getHours() in a UTC server would give the wrong hour.
// Extract the hour directly from position 11-12 of the ISO string.
function localHourFromEsios(datetime: string): number {
  return parseInt(datetime.substring(11, 13), 10)
}

export async function GET() {
  const token = process.env.ESIOS_TOKEN

  if (!token) {
    return NextResponse.json(buildMockResponse())
  }

  try {
    // Use Spain local date (UTC+1 / UTC+2) for the query
    const now = new Date()
    const spainOffset = isDST(now) ? 2 : 1
    const spainTime = new Date(now.getTime() + spainOffset * 3600 * 1000)
    const dateStr = spainTime.toISOString().split('T')[0]

    const res = await fetch(
      `https://api.esios.ree.es/indicators/600?locale=es&start_date=${dateStr}T00:00:00&end_date=${dateStr}T23:59:59`,
      {
        headers: {
          Authorization: `Token token="${token}"`,
          Accept: 'application/json; application/vnd.esios-api-v2+json',
        },
        next: { revalidate: 3600 },
      }
    )

    if (!res.ok) {
      console.warn('[market-hourly] ESIOS status', res.status)
      return NextResponse.json(buildMockResponse())
    }

    const json = await res.json()
    // Filter geo_id=3 (España) — ESIOS can include Portugal (geo_id=4)
    const values: { value: number; datetime: string; geo_id?: number }[] =
      (json?.indicator?.values ?? []).filter(
        (v: { geo_id?: number }) => !v.geo_id || v.geo_id === 3
      )

    if (values.length === 0) {
      return NextResponse.json(buildMockResponse())
    }

    // Indicator 600 returns €/kWh — multiply by 1000 to get €/MWh
    const isKwh = values[0]?.value != null && values[0].value < 2

    const precios: HourlyPrice[] = Array.from({ length: 24 }, (_, h) => {
      const match = values.find((v) => localHourFromEsios(v.datetime) === h)
      const raw = match?.value ?? 0
      return {
        hora: h,
        precio_mwh: Math.round((isKwh ? raw * 1000 : raw) * 10) / 10,
        es_barata: false,
        es_cara: false,
      }
    })

    const nums = precios.map((p) => p.precio_mwh)
    const sorted = [...nums].sort((a, b) => a - b)
    const p33 = percentile(sorted, 0.33)
    const p66 = percentile(sorted, 0.66)
    precios.forEach((p) => {
      p.es_barata = p.precio_mwh > 0 && p.precio_mwh <= p33
      p.es_cara = p.precio_mwh >= p66
    })

    const ahoraHora = spainTime.getUTCHours()
    const hora_min = precios.reduce((mi, p, i, arr) => p.precio_mwh > 0 && p.precio_mwh < arr[mi].precio_mwh ? i : mi, 0)
    const hora_max = precios.reduce((mi, p, i, arr) => p.precio_mwh > arr[mi].precio_mwh ? i : mi, 0)

    return NextResponse.json({
      precios,
      ahora: ahoraHora,
      precio_ahora: precios[ahoraHora]?.precio_mwh ?? 0,
      minimo: precios[hora_min].precio_mwh,
      maximo: precios[hora_max].precio_mwh,
      media: Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10,
      hora_min,
      hora_max,
    } satisfies MarketHourlyResponse)
  } catch (err) {
    console.error('[market-hourly]', err)
    return NextResponse.json(buildMockResponse())
  }
}

// Rough DST detection for Spain (last Sun March → last Sun October)
function isDST(date: Date): boolean {
  const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset()
  const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset()
  return date.getTimezoneOffset() < Math.max(jan, jul)
}

function buildMockResponse(): MarketHourlyResponse {
  const base = [
    68, 62, 58, 55, 53, 56, 72, 95, 118, 112, 105, 98,
    94, 92, 96, 102, 115, 132, 145, 138, 122, 108, 92, 78,
  ]
  const precios_raw = base.map((v) => Math.max(10, v + (Math.random() - 0.5) * 8))
  const sorted = [...precios_raw].sort((a, b) => a - b)
  const p33 = sorted[Math.floor(sorted.length * 0.33)]
  const p66 = sorted[Math.floor(sorted.length * 0.66)]

  const precios: HourlyPrice[] = precios_raw.map((v, h) => ({
    hora: h,
    precio_mwh: Math.round(v * 10) / 10,
    es_barata: v <= p33,
    es_cara: v >= p66,
  }))

  // Spain current hour (approximate)
  const now = new Date()
  const offset = isDST(now) ? 2 : 1
  const ahora = new Date(now.getTime() + offset * 3600 * 1000).getUTCHours()

  const hora_min = precios.reduce((mi, p, i, arr) => p.precio_mwh < arr[mi].precio_mwh ? i : mi, 0)
  const hora_max = precios.reduce((mi, p, i, arr) => p.precio_mwh > arr[mi].precio_mwh ? i : mi, 0)

  return {
    precios,
    ahora,
    precio_ahora: precios[ahora].precio_mwh,
    minimo: precios[hora_min].precio_mwh,
    maximo: precios[hora_max].precio_mwh,
    media: Math.round((precios.reduce((a, p) => a + p.precio_mwh, 0) / precios.length) * 10) / 10,
    hora_min,
    hora_max,
  }
}
