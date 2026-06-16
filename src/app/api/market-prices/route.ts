import { NextResponse } from 'next/server'

// Migrado de ESIOS a la API pública de REE (apidatos.ree.es) — sin token, sin
// restricciones. Esta ruta la llama una página PÚBLICA (/mercado), así que
// NUNCA debe depender de ESIOS (el token es de uso personal, ver condiciones).

function spainOffset(): number {
  const now = new Date()
  const jan = new Date(now.getFullYear(), 0, 1).getTimezoneOffset()
  const jul = new Date(now.getFullYear(), 6, 1).getTimezoneOffset()
  const isDST = now.getTimezoneOffset() < Math.max(jan, jul)
  return isDST ? 2 : 1
}

function parseLocalDateTime(datetime: string): { hour: number; dow: number } {
  const datePart = datetime.substring(0, 10)
  const hour = parseInt(datetime.substring(11, 13), 10)
  const d = new Date(datePart + 'T12:00:00Z')
  return { hour, dow: d.getUTCDay() }
}

// 3.0TD hour→period mapping (peninsular Spain)
function getPeriodo(hour: number, dayOfWeek: number): string {
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  if (isWeekend) return 'P3'
  if ((hour >= 10 && hour < 14) || (hour >= 18 && hour < 22)) return 'P1'
  if (hour >= 8 && hour < 24) return 'P2'
  return 'P3'
}

interface ReeValue {
  value: number
  datetime: string
}

async function fetchReeDay(date: string): Promise<ReeValue[]> {
  const url = `https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?time_trunc=hour&start_date=${date}T00:00&end_date=${date}T23:59&geo_trunc=electric_system&geo_limit=peninsular&geo_ids=8741`
  const res = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`REE: ${res.status}`)
  const json = await res.json()
  return json?.included?.[0]?.attributes?.values ?? []
}

export async function GET() {
  try {
    const offset = spainOffset()
    const spainNow = new Date(Date.now() + offset * 3600 * 1000)
    const dateStr = spainNow.toISOString().split('T')[0]

    const values = await fetchReeDay(dateStr) // €/MWh ya

    const periodos: Record<string, number[]> = { P1: [], P2: [], P3: [] }
    for (const v of values) {
      if (v.value == null) continue
      const { hour, dow } = parseLocalDateTime(v.datetime)
      periodos[getPeriodo(hour, dow)].push(v.value)
    }

    const yesterday = new Date(spainNow)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const yDateStr = yesterday.toISOString().split('T')[0]
    let yValues: ReeValue[] = []
    try { yValues = await fetchReeDay(yDateStr) } catch { /* ignore */ }

    const yPeriodos: Record<string, number[]> = { P1: [], P2: [], P3: [] }
    for (const v of yValues) {
      if (v.value == null) continue
      const { hour, dow } = parseLocalDateTime(v.datetime)
      yPeriodos[getPeriodo(hour, dow)].push(v.value)
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
