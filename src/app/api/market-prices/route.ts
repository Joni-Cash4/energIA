import { NextResponse } from 'next/server'

const ESIOS_TOKEN = process.env.ESIOS_TOKEN ?? ''
const ESIOS_BASE = 'https://api.esios.ree.es'

// Determine Spain local time offset (UTC+1 winter, UTC+2 summer)
function spainOffset(): number {
  const now = new Date()
  const jan = new Date(now.getFullYear(), 0, 1).getTimezoneOffset()
  const jul = new Date(now.getFullYear(), 6, 1).getTimezoneOffset()
  const isDST = now.getTimezoneOffset() < Math.max(jan, jul)
  return isDST ? 2 : 1
}

// ESIOS `datetime` is in Spain local time: "2024-01-15T01:00:00.000+01:00"
// Extract hour and day-of-week directly from the string to avoid UTC offset errors.
function parseLocalDateTime(datetime: string): { hour: number; dow: number } {
  // "YYYY-MM-DDTHH:MM:SS..." — substring(0,10) = date, substring(11,13) = hour
  const datePart = datetime.substring(0, 10)
  const hour = parseInt(datetime.substring(11, 13), 10)
  const d = new Date(datePart + 'T12:00:00Z') // noon UTC to avoid DST ambiguity
  return { hour, dow: d.getUTCDay() }
}

// 3.0TD hour→period mapping (peninsular Spain)
// P1 10-14 + 18-22 weekdays | P2 rest of weekday hours | P3 nights + all weekend
function getPeriodo(hour: number, dayOfWeek: number): string {
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  if (isWeekend) return 'P3'
  if ((hour >= 10 && hour < 14) || (hour >= 18 && hour < 22)) return 'P1'
  if (hour >= 8 && hour < 24) return 'P2'
  return 'P3'
}

interface EsiosValue {
  value: number
  datetime: string
  datetime_utc: string
  geo_id?: number
}

async function fetchEsiosIndicator(id: number, date: string): Promise<EsiosValue[]> {
  const url = `${ESIOS_BASE}/indicators/${id}?locale=es&start_date=${date}T00:00:00&end_date=${date}T23:59:59`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json; application/vnd.esios-api-v2+json',
      Authorization: `Token token="${ESIOS_TOKEN}"`,
    },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`ESIOS ${id}: ${res.status}`)
  const json = await res.json()
  // Filter geo_id=3 (España) — avoid mixing in Portugal (geo_id=4)
  const all: EsiosValue[] = json?.indicator?.values ?? []
  return all.filter((v) => !v.geo_id || v.geo_id === 3)
}

export async function GET() {
  try {
    // Use Spain local date to avoid midnight boundary issues
    const offset = spainOffset()
    const spainNow = new Date(Date.now() + offset * 3600 * 1000)
    const dateStr = spainNow.toISOString().split('T')[0]

    const values = await fetchEsiosIndicator(600, dateStr)

    // Indicator 600 returns €/kWh when values < 2; multiply by 1000 → €/MWh
    const isKwh = values.length > 0 && values[0].value != null && values[0].value < 2
    const toMwh = (v: number) => isKwh ? v * 1000 : v

    // Group by 3.0TD period
    const periodos: Record<string, number[]> = { P1: [], P2: [], P3: [] }
    for (const v of values) {
      if (v.value == null) continue
      const { hour, dow } = parseLocalDateTime(v.datetime)
      const period = getPeriodo(hour, dow)
      periodos[period].push(toMwh(v.value))
    }

    // Yesterday for variation
    const yesterday = new Date(spainNow)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const yDateStr = yesterday.toISOString().split('T')[0]
    let yValues: EsiosValue[] = []
    try { yValues = await fetchEsiosIndicator(600, yDateStr) } catch { /* ignore */ }

    const yPeriodos: Record<string, number[]> = { P1: [], P2: [], P3: [] }
    for (const v of yValues) {
      if (v.value == null) continue
      const { hour, dow } = parseLocalDateTime(v.datetime)
      const period = getPeriodo(hour, dow)
      yPeriodos[period].push(toMwh(v.value))
    }

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

    const result = (['P1', 'P2', 'P3'] as const).map((p) => {
      const precio = avg(periodos[p])
      const yPrecio = avg(yPeriodos[p])
      const variacion = yPrecio > 0 ? ((precio - yPrecio) / yPrecio) * 100 : 0
      return {
        periodo: p,
        precio_mwh: Math.round(precio * 100) / 100,
        precio_kwh: Math.round((precio / 1000) * 10000) / 10000,
        variacion: Math.round(variacion * 10) / 10,
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[market-prices]', err)
    return NextResponse.json([
      { periodo: 'P1', precio_mwh: 95.0, precio_kwh: 0.095, variacion: 0 },
      { periodo: 'P2', precio_mwh: 72.0, precio_kwh: 0.072, variacion: 0 },
      { periodo: 'P3', precio_mwh: 48.0, precio_kwh: 0.048, variacion: 0 },
    ])
  }
}
