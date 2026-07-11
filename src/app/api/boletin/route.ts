import { NextRequest, NextResponse } from 'next/server'

// Boletín semanal del mercado — generado íntegramente con datos públicos de la
// API de REE (apidatos.ree.es, sin token). Misma política que market-weekly:
// esta ruta la consume una página PÚBLICA, así que nunca debe usar ESIOS.
// IMPORTANTE: aquí NO hay datos mock — es contenido publicado; si REE falla,
// devolvemos 503 y la página muestra un aviso en lugar de inventar cifras.

export const revalidate = 3600

const REE = 'https://apidatos.ree.es/es/datos'
const GEO = 'geo_trunc=electric_system&geo_limit=peninsular&geo_ids=8741'

// ── Fechas ──────────────────────────────────────────────────────────────────

function spainOffset(): number {
  const now = new Date()
  const jan = new Date(now.getFullYear(), 0, 1).getTimezoneOffset()
  const jul = new Date(now.getFullYear(), 6, 1).getTimezoneOffset()
  return now.getTimezoneOffset() < Math.max(jan, jul) ? 2 : 1
}

function spainToday(): Date {
  const d = new Date(Date.now() + spainOffset() * 3600 * 1000)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

function minusOneYear(d: Date): Date {
  const r = new Date(d)
  r.setUTCFullYear(r.getUTCFullYear() - 1)
  return r
}

// Lunes de la última semana COMPLETA (lunes–domingo ya cerrado)
function latestCompleteMonday(): Date {
  const today = spainToday()
  const dow = today.getUTCDay() // 0=dom
  const lastSunday = addDays(today, dow === 0 ? -7 : -dow)
  return addDays(lastSunday, -6)
}

function fmtDay(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return d.toLocaleDateString('es-ES', { ...opts, timeZone: 'UTC' })
}

function weekLabel(monday: Date): string {
  const sunday = addDays(monday, 6)
  const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth()
  const ini = fmtDay(monday, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })
  const fin = fmtDay(sunday, { day: 'numeric', month: 'short', year: 'numeric' })
  return `Semana del ${ini} al ${fin}`
}

// ── Fetchers REE ────────────────────────────────────────────────────────────

async function ree(path: string, start: string, end: string, trunc: string, geo = true): Promise<any> {
  const url = `${REE}/${path}?time_trunc=${trunc}&start_date=${start}T00:00&end_date=${end}T23:59${geo ? `&${GEO}` : ''}`
  const res = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`REE ${path} → ${res.status}`)
  return res.json()
}

// Media diaria del precio spot. OJO: sin filtro geográfico — con geo peninsular
// REE solo devuelve la serie PVPC; la serie "Precio mercado spot" (única para
// todo el mercado) solo aparece en la consulta sin geo.
async function fetchSpotDaily(start: string, end: string): Promise<Record<string, number>> {
  const json = await ree('mercados/precios-mercados-tiempo-real', start, end, 'hour', false)
  const serie = (json?.included ?? []).find((s: any) =>
    (s?.attributes?.title ?? '').toLowerCase().includes('spot'))
  const byDate: Record<string, number[]> = {}
  for (const v of serie?.attributes?.values ?? []) {
    if (v.value == null) continue
    const d = v.datetime.substring(0, 10)
    ;(byDate[d] ??= []).push(v.value)
  }
  const out: Record<string, number> = {}
  for (const [d, vals] of Object.entries(byDate)) {
    out[d] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
  }
  return out
}

interface Tech { nombre: string; mwh: number; renovable: boolean }

async function fetchGeneracion(start: string, end: string): Promise<{ total: number; techs: Tech[] }> {
  const json = await ree('generacion/estructura-generacion', start, end, 'day')
  let total = 0
  const techs: Tech[] = []
  for (const inc of json?.included ?? []) {
    const a = inc?.attributes
    if (!a?.values) continue
    const mwh = a.values.reduce((s: number, v: any) => s + (v.value ?? 0), 0)
    if (a.title === 'Generación total') total = mwh
    else techs.push({ nombre: a.title, mwh, renovable: a.type === 'Renovable' })
  }
  return { total, techs }
}

async function fetchDemanda(start: string, end: string): Promise<number> {
  const json = await ree('demanda/evolucion', start, end, 'day')
  const vals = json?.included?.[0]?.attributes?.values ?? []
  return vals.reduce((s: number, v: any) => s + (v.value ?? 0), 0)
}

// ── Utilidades ──────────────────────────────────────────────────────────────

function pct(actual: number, previo: number): number | null {
  if (!previo) return null
  return Math.round(((actual - previo) / previo) * 1000) / 10
}

function avg(arr: number[]): number {
  if (!arr.length) return 0
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100
}

function fmt(n: number, dec = 1): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function signo(v: number | null): string {
  if (v == null) return ''
  return v >= 0 ? `+${fmt(v)}%` : `${fmt(v)}%`
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const defaultMonday = latestCompleteMonday()
  let monday = defaultMonday

  const startParam = req.nextUrl.searchParams.get('start')
  if (startParam && /^\d{4}-\d{2}-\d{2}$/.test(startParam)) {
    const d = new Date(startParam + 'T00:00:00Z')
    const okRange = d <= defaultMonday && d >= addDays(defaultMonday, -7 * 25)
    if (!isNaN(d.getTime()) && d.getUTCDay() === 1 && okRange) monday = d
  }

  const sunday = addDays(monday, 6)
  const prevMonday = addDays(monday, -7)
  const prevSunday = addDays(monday, -1)
  const lyMonday = minusOneYear(monday)
  const lySunday = minusOneYear(sunday)

  const [start, end] = [dateStr(monday), dateStr(sunday)]

  try {
    const [spot, spotPrev, spotLy, gen, genLy, dem, demLy] = await Promise.all([
      fetchSpotDaily(start, end),
      fetchSpotDaily(dateStr(prevMonday), dateStr(prevSunday)),
      fetchSpotDaily(dateStr(lyMonday), dateStr(lySunday)),
      fetchGeneracion(start, end),
      fetchGeneracion(dateStr(lyMonday), dateStr(lySunday)),
      fetchDemanda(start, end),
      fetchDemanda(dateStr(lyMonday), dateStr(lySunday)),
    ])

    // ── Precios ──
    const dias = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i)
      const dLy = minusOneYear(d)
      return {
        fecha: dateStr(d),
        label: fmtDay(d, { weekday: 'short', day: 'numeric' }),
        media: spot[dateStr(d)] ?? null,
        mediaAnterior: spotLy[dateStr(dLy)] ?? null,
      }
    })
    const valores = dias.map((d) => d.media).filter((v): v is number => v != null)
    if (valores.length < 5 || !gen.total || !dem) {
      return NextResponse.json({ error: 'Datos de REE incompletos para esta semana' }, { status: 503 })
    }
    const media = avg(valores)
    const mediaPrev = avg(Object.values(spotPrev))
    const mediaLy = avg(Object.values(spotLy))
    const diaMax = dias.reduce((a, b) => ((b.media ?? -1) > (a.media ?? -1) ? b : a))
    const diaMin = dias.reduce((a, b) => ((b.media ?? 1e9) < (a.media ?? 1e9) ? b : a))
    const varSemanal = pct(media, mediaPrev)
    const varInteranual = pct(media, mediaLy)

    // ── Generación ──
    const lyByName = Object.fromEntries(genLy.techs.map((t) => [t.nombre, t.mwh]))
    const renMwh = gen.techs.filter((t) => t.renovable).reduce((s, t) => s + t.mwh, 0)
    const renMwhLy = genLy.techs.filter((t) => t.renovable).reduce((s, t) => s + t.mwh, 0)
    const cuotaRen = Math.round((renMwh / gen.total) * 1000) / 10

    const tecnologias = gen.techs
      .filter((t) => t.mwh / gen.total >= 0.01)
      .sort((a, b) => b.mwh - a.mwh)
      .map((t) => ({
        nombre: t.nombre,
        renovable: t.renovable,
        gwh: Math.round(t.mwh / 100) / 10,
        cuota: Math.round((t.mwh / gen.total) * 1000) / 10,
        variacion: pct(t.mwh, lyByName[t.nombre] ?? 0),
      }))

    const top = tecnologias[0]

    // ── Demanda ──
    const demGwh = Math.round(dem / 100) / 10
    const varDemanda = pct(dem, demLy)

    // ── Textos (plantillas según datos — redacción propia, fuente REE) ──
    const mercado: string[] = []
    mercado.push(
      `El precio medio del mercado mayorista se situó en ${fmt(media, 2)} €/MWh esta semana` +
      (varSemanal != null ? `, un ${fmt(Math.abs(varSemanal))}% ${varSemanal >= 0 ? 'más' : 'menos'} que la semana anterior` : '') +
      (varInteranual != null ? ` y un ${fmt(Math.abs(varInteranual))}% ${varInteranual >= 0 ? 'por encima' : 'por debajo'} del mismo periodo de ${lyMonday.getUTCFullYear()}` : '') + '.'
    )
    if (diaMax.media != null && diaMin.media != null) {
      const ratio = diaMin.media > 0 ? diaMax.media / diaMin.media : 99
      mercado.push(
        `El día más caro fue el ${fmtDay(new Date(diaMax.fecha + 'T12:00:00Z'), { weekday: 'long', day: 'numeric' })} ` +
        `(${fmt(diaMax.media, 2)} €/MWh) y el más barato el ${fmtDay(new Date(diaMin.fecha + 'T12:00:00Z'), { weekday: 'long', day: 'numeric' })} ` +
        `(${fmt(diaMin.media, 2)} €/MWh)` +
        (ratio > 2 ? ', una horquilla que refleja la elevada volatilidad actual del mercado.' : '.')
      )
    }

    const balance: string[] = []
    if (varDemanda != null) {
      balance.push(
        `La demanda eléctrica peninsular fue de ${fmt(demGwh, 0)} GWh, un ${fmt(Math.abs(varDemanda))}% ` +
        `${varDemanda >= 0 ? 'superior' : 'inferior'} a la del mismo periodo del año pasado.`
      )
    }
    const varRen = pct(renMwh, renMwhLy)
    balance.push(
      `Las energías renovables aportaron el ${fmt(cuotaRen)}% de la generación peninsular` +
      (varRen != null ? ` (${signo(varRen)} interanual)` : '') +
      (top ? `. La tecnología con mayor peso fue ${top.nombre.toLowerCase()} con una cuota del ${fmt(top.cuota)}%` +
        (top.variacion != null ? ` (${signo(top.variacion)} respecto a ${lyMonday.getUTCFullYear()})` : '') : '') + '.'
    )

    // ── Archivo de semanas disponibles ──
    const semanas = Array.from({ length: 12 }, (_, i) => {
      const m = addDays(defaultMonday, -7 * i)
      return { inicio: dateStr(m), label: weekLabel(m) }
    })

    return NextResponse.json({
      semana: { inicio: start, fin: end, label: weekLabel(monday) },
      precios: {
        dias, media, mediaSemanaAnterior: mediaPrev || null, variacionSemanal: varSemanal,
        mediaAnyoPasado: mediaLy || null, variacionInteranual: varInteranual,
        max: { fecha: diaMax.fecha, media: diaMax.media },
        min: { fecha: diaMin.fecha, media: diaMin.media },
      },
      demanda: { gwh: demGwh, variacionInteranual: varDemanda },
      generacion: {
        totalGwh: Math.round(gen.total / 100) / 10,
        renovablesGwh: Math.round(renMwh / 100) / 10,
        cuotaRenovable: cuotaRen,
        variacionRenovables: varRen,
        tecnologias,
      },
      textos: { mercado, balance },
      semanas,
      fuente: 'Red Eléctrica de España (apidatos.ree.es) · Elaboración propia',
    })
  } catch (err) {
    console.error('[boletin]', err)
    return NextResponse.json({ error: 'No se pudieron obtener los datos de REE' }, { status: 503 })
  }
}
