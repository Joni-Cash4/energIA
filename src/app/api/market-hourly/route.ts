import { NextRequest, NextResponse } from 'next/server'
import type { HourlyPrice, MarketHourlyResponse } from '@/types'

export const revalidate = 3600

// REE public API — no token required
// https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real
const GEO_LIMITS: Record<string, string> = {
  peninsula: 'peninsular',
  baleares:  'balear',
  canarias:  'canarias',
}
const GEO_IDS: Record<string, string> = {
  peninsula: '8741',
  baleares:  '8742',
  canarias:  '8743',
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.floor(sorted.length * p)
  return sorted[Math.min(idx, sorted.length - 1)]
}

function isDST(date: Date): boolean {
  const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset()
  const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset()
  return date.getTimezoneOffset() < Math.max(jan, jul)
}

export async function GET(req: NextRequest) {
  const zona = req.nextUrl.searchParams.get('zona') ?? 'peninsula'
  const geoLimit = GEO_LIMITS[zona] ?? 'peninsular'
  const geoId    = GEO_IDS[zona]    ?? '8741'

  try {
    const now = new Date()
    const spainOffset = isDST(now) ? 2 : 1
    const spainTime = new Date(now.getTime() + spainOffset * 3600 * 1000)
    const dateStr = spainTime.toISOString().split('T')[0]

    const url =
      `https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real` +
      `?time_trunc=hour` +
      `&start_date=${dateStr}T00:00` +
      `&end_date=${dateStr}T23:59` +
      `&geo_trunc=electric_system` +
      `&geo_limit=${geoLimit}` +
      `&geo_ids=${geoId}`

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[market-hourly] REE error', res.status, zona, body.slice(0, 200))
      return NextResponse.json({
        ...buildMockResponse(),
        _source: 'mock_ree_error',
        _error: `HTTP ${res.status}: ${body.slice(0, 300)}`,
        _zona: zona,
      })
    }

    const json = await res.json()

    // REE returns included[] array; find the PVPC or spot price widget
    const included: { type: string; attributes: { title: string; values: { value: number; datetime: string }[] } }[] =
      json?.included ?? []

    // Prefer PVPC (id ends in "PVPC"); fallback to first price series
    const series =
      included.find((s) => s.attributes?.title?.toLowerCase().includes('pvpc')) ??
      included.find((s) => (s.attributes?.values?.length ?? 0) > 0)

    const values = series?.attributes?.values ?? []

    if (values.length === 0) {
      return NextResponse.json({ ...buildMockResponse(), _source: 'mock_no_values', _zona: zona })
    }

    // value is €/MWh in REE datos API
    const precios: HourlyPrice[] = Array.from({ length: 24 }, (_, h) => {
      const match = values.find((v) => parseInt(v.datetime.substring(11, 13), 10) === h)
      return {
        hora: h,
        precio_mwh: match ? Math.round(match.value * 10) / 10 : 0,
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
      _source: 'ree_datos',
      _date: dateStr,
      _values_count: values.length,
      _zona: zona,
    } satisfies MarketHourlyResponse)
  } catch (err) {
    console.error('[market-hourly]', err)
    return NextResponse.json({ ...buildMockResponse(), _source: 'mock_exception', _error: String(err) })
  }
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

  const now = new Date()
  const offset = isDST(now) ? 2 : 1
  const ahora = new Date(now.getTime() + offset * 3600 * 1000).getUTCHours()
  const hora_min = precios.reduce((mi, p, i, arr) => p.precio_mwh < arr[mi].precio_mwh ? i : mi, 0)
  const hora_max = precios.reduce((mi, p, i, arr) => p.precio_mwh > arr[mi].precio_mwh ? i : mi, 0)

  return {
    precios, ahora,
    precio_ahora: precios[ahora].precio_mwh,
    minimo: precios[hora_min].precio_mwh,
    maximo: precios[hora_max].precio_mwh,
    media: Math.round((precios.reduce((a, p) => a + p.precio_mwh, 0) / precios.length) * 10) / 10,
    hora_min, hora_max,
  }
}
