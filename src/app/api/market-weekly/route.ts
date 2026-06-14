import { NextResponse } from 'next/server'

export const revalidate = 3600

const ESIOS_BASE = 'https://api.esios.ree.es'

function spainOffset(): number {
  const now = new Date()
  const jan = new Date(now.getFullYear(), 0, 1).getTimezoneOffset()
  const jul = new Date(now.getFullYear(), 6, 1).getTimezoneOffset()
  return now.getTimezoneOffset() < Math.max(jan, jul) ? 2 : 1
}

function spainNow(): Date {
  const offset = spainOffset()
  return new Date(Date.now() + offset * 3600 * 1000)
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

function avg(arr: number[]): number {
  if (!arr.length) return 0
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
}

export async function GET() {
  const token = process.env.ESIOS_TOKEN

  const today = spainNow()
  const startDate = new Date(today)
  startDate.setUTCDate(startDate.getUTCDate() - 13)

  const start = dateStr(startDate)
  const end = dateStr(today)

  // Build list of 14 date strings
  const allDates: string[] = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(startDate)
    d.setUTCDate(d.getUTCDate() + i)
    allDates.push(dateStr(d))
  }

  const lastWeekDates = allDates.slice(0, 7)
  const thisWeekDates = allDates.slice(7)

  if (!token) {
    return NextResponse.json(buildMock(thisWeekDates, lastWeekDates))
  }

  try {
    // Single request for 14 days — indicator 1 = precio spot OMIE €/MWh
    const url = `${ESIOS_BASE}/indicators/1?locale=es&start_date=${start}T00:00:00&end_date=${end}T23:59:59`
    const res = await fetch(url, {
      headers: {
        Authorization: `Token token="${token}"`,
        Accept: 'application/json; application/vnd.esios-api-v2+json',
        'User-Agent': 'IAenergia/1.0 (+https://iaenergia.es)',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      console.warn('[market-weekly] ESIOS status', res.status)
      return NextResponse.json(buildMock(thisWeekDates, lastWeekDates))
    }

    const json = await res.json()
    const values: { value: number; datetime: string; geo_id?: number }[] =
      json?.indicator?.values ?? []

    if (values.length === 0) {
      console.warn('[market-weekly] No values returned from ESIOS')
      return NextResponse.json(buildMock(thisWeekDates, lastWeekDates))
    }

    // Group values by Spain local date (first 10 chars of datetime string)
    const byDate: Record<string, number[]> = {}
    for (const v of values) {
      if (v.value == null || v.value <= 0) continue
      const d = v.datetime.substring(0, 10)
      if (!byDate[d]) byDate[d] = []
      byDate[d].push(v.value)
    }

    const thisWeek = thisWeekDates.map((d) => ({
      fecha: d,
      label: dayLabel(d),
      media: avg(byDate[d] ?? []),
    }))

    const lastWeek = lastWeekDates.map((d) => ({
      fecha: d,
      label: dayLabel(d),
      media: avg(byDate[d] ?? []),
    }))

    return NextResponse.json(buildResponse(thisWeek, lastWeek))
  } catch (err) {
    console.error('[market-weekly]', err)
    return NextResponse.json(buildMock(thisWeekDates, lastWeekDates))
  }
}

function buildResponse(
  thisWeek: { fecha: string; label: string; media: number }[],
  lastWeek: { fecha: string; label: string; media: number }[]
) {
  const mediaEsta = avg(thisWeek.map((d) => d.media).filter(Boolean))
  const mediaAnterior = avg(lastWeek.map((d) => d.media).filter(Boolean))
  const variacion = mediaAnterior > 0
    ? Math.round(((mediaEsta - mediaAnterior) / mediaAnterior) * 1000) / 10
    : 0
  return { thisWeek, lastWeek, mediaEsta, mediaAnterior, variacion }
}

function buildMock(thisWeekDates: string[], lastWeekDates: string[]) {
  const base = [82, 91, 78, 105, 88, 74, 95]
  const thisWeek = thisWeekDates.map((d, i) => ({
    fecha: d, label: dayLabel(d),
    media: base[i] + Math.round((Math.random() - 0.5) * 12),
  }))
  const lastWeek = lastWeekDates.map((d, i) => ({
    fecha: d, label: dayLabel(d),
    media: base[i] + Math.round((Math.random() - 0.5) * 18),
  }))
  return buildResponse(thisWeek, lastWeek)
}
