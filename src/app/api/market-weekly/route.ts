import { NextResponse } from 'next/server'

// Migrado de ESIOS a la API pública de REE (apidatos.ree.es) — sin token, sin
// restricciones. Esta ruta la llama una página PÚBLICA (/mercado), así que
// NUNCA debe depender de ESIOS (el token es de uso personal, ver condiciones).

export const revalidate = 3600

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
  const today = spainNow()
  const startDate = new Date(today)
  startDate.setUTCDate(startDate.getUTCDate() - 13)

  const start = dateStr(startDate)
  const end = dateStr(today)

  const allDates: string[] = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(startDate)
    d.setUTCDate(d.getUTCDate() + i)
    allDates.push(dateStr(d))
  }

  const lastWeekDates = allDates.slice(0, 7)
  const thisWeekDates = allDates.slice(7)

  try {
    // Una sola petición para los 14 días — REE pública, sin token
    const url = `https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?time_trunc=hour&start_date=${start}T00:00&end_date=${end}T23:59&geo_trunc=electric_system&geo_limit=peninsular&geo_ids=8741`
    const res = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 3600 } })

    if (!res.ok) {
      console.warn('[market-weekly] REE status', res.status)
      return NextResponse.json(buildMock(thisWeekDates, lastWeekDates))
    }

    const json = await res.json()
    const values: { value: number; datetime: string }[] = json?.included?.[0]?.attributes?.values ?? []

    if (values.length === 0) {
      console.warn('[market-weekly] Sin valores de REE')
      return NextResponse.json(buildMock(thisWeekDates, lastWeekDates))
    }

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
