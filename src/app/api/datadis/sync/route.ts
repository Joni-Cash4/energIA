import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DATADIS_BASE = 'https://datadis.es'
const DATADIS_USER = process.env.DATADIS_USERNAME!
const DATADIS_PASS = process.env.DATADIS_PASSWORD!
const BUCKET = 'datadis-raw'

let cachedToken: string | null = null
let tokenExpiry = 0

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  const res = await fetch(`${DATADIS_BASE}/nikola-auth/tokens/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: DATADIS_USER, password: DATADIS_PASS }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Datadis login failed: ${res.status}`)
  const token = (await res.text()).replace(/"/g, '')
  if (!token) throw new Error('Datadis login returned empty token')
  cachedToken = token
  tokenExpiry = Date.now() + 50 * 60 * 1000
  return cachedToken
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function buildMonthList(months: number): string[] {
  const list: string[] = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    list.push(`${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return list
}

function monthToDbKey(m: string) { return m.replace('/', '-') } // YYYY-MM

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureBucket(supabase: any) {
  await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {})
}

async function getStoredFile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  clienteId: string,
  cups: string,
  ym: string, // YYYY-MM
): Promise<object | null> {
  const path = `${clienteId}/${cups}/${ym}.json`
  const { data } = await supabase.storage.from(BUCKET).download(path)
  if (!data) return null
  try {
    return JSON.parse(await data.text())
  } catch {
    return null
  }
}

async function saveStoredFile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  clienteId: string,
  cups: string,
  ym: string,
  content: object,
) {
  const path = `${clienteId}/${cups}/${ym}.json`
  const blob = new Blob([JSON.stringify(content)], { type: 'application/json' })
  await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true })
}

export async function POST(req: NextRequest) {
  try {
    const { clienteId, nif, cups, meses = 13 } = await req.json()

    if (!clienteId || !cups) {
      return NextResponse.json({ error: 'clienteId y cups son obligatorios' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
    )

    await ensureBucket(supabase)

    const allMonths = buildMonthList(meses)
    const allMonthsDb = allMonths.map(monthToDbKey)
    const currentMonth = allMonthsDb[allMonthsDb.length - 1]
    const SIX_HOURS = 6 * 60 * 60 * 1000

    // Check existing DB aggregates to avoid redundant Datadis calls
    const { data: existingRows } = await supabase
      .from('consumos_datadis')
      .select('year_month, kwh_total, fecha_consulta')
      .eq('cliente_id', clienteId)
      .eq('cups', cups)
      .in('year_month', allMonthsDb)

    const dbByMonth = Object.fromEntries(
      (existingRows ?? []).map(r => [r.year_month, r])
    )

    const monthsToFetch: string[] = []
    const cachedData: Record<string, object> = {}

    for (const m of allMonths) {
      const ym = monthToDbKey(m)

      // 1. Storage file (has full 15-min data)
      const stored = await getStoredFile(supabase, clienteId, cups, ym)
      if (stored) {
        const age = Date.now() - new Date((stored as { synced_at?: string }).synced_at ?? 0).getTime()
        if (ym !== currentMonth || age < SIX_HOURS) {
          cachedData[ym] = stored
          continue
        }
      }

      // 2. DB aggregate for past months — don't re-fetch
      if (ym !== currentMonth && dbByMonth[ym]) {
        cachedData[ym] = { kwh_total: dbByMonth[ym].kwh_total, synced_at: dbByMonth[ym].fecha_consulta }
        continue
      }

      // 3. Current month: skip if synced <6h ago
      if (ym === currentMonth && dbByMonth[ym]) {
        const age = Date.now() - new Date(dbByMonth[ym].fecha_consulta).getTime()
        if (age < SIX_HOURS) {
          cachedData[ym] = { kwh_total: dbByMonth[ym].kwh_total, synced_at: dbByMonth[ym].fecha_consulta }
          continue
        }
      }

      monthsToFetch.push(m)
    }

    const totalCached = Object.keys(cachedData).length
    console.log(`[datadis] cached: ${totalCached} | to fetch: ${monthsToFetch.length}`)

    let newData: Record<string, { readings: Array<{ date: string; time: string; consumptionKWh: number }>; kwh_total: number }> = {}

    if (monthsToFetch.length > 0) {
      const token = await getToken()
      const authHeader = `Bearer ${token}`
      const isOwnSupply = !nif || nif === DATADIS_USER

      // 1. Get supply info
      await sleep(2000)
      const suppliesUrl = isOwnSupply
        ? `${DATADIS_BASE}/api-private/api/get-supplies`
        : `${DATADIS_BASE}/api-private/api/get-supplies-v2?authorizedNif=${encodeURIComponent(nif)}`

      console.log(`[datadis] supplies → ${suppliesUrl}`)
      const suppliesRes = await fetch(suppliesUrl, {
        headers: { authorization: authHeader, Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store',
      })
      console.log(`[datadis] supplies status: ${suppliesRes.status}`)
      if (suppliesRes.status === 429) throw new Error('Datadis: límite de peticiones (supplies), intenta en unos minutos')
      if (!suppliesRes.ok) throw new Error(`Supplies fetch failed: ${suppliesRes.status}`)

      const supplies: Array<{ cups: string; distributorCode: number; pointType: number }> =
        await suppliesRes.json()

      const supply = Array.isArray(supplies) ? supplies.find(s => s.cups === cups) : null
      if (!supply) {
        return NextResponse.json(
          { error: `CUPS ${cups} no encontrado${nif ? ` en autorizaciones de ${nif}` : ''}` },
          { status: 404 },
        )
      }

      // 2. Fetch missing months in one range call
      const start = monthsToFetch[0]
      const end = monthsToFetch[monthsToFetch.length - 1]

      await sleep(5000)
      const consumptionUrl =
        `${DATADIS_BASE}/api-private/api/get-consumption-data` +
        `?cups=${encodeURIComponent(cups)}` +
        `&distributorCode=${supply.distributorCode}` +
        `&startDate=${start}` +
        `&endDate=${end}` +
        `&measurementType=0` +
        `&pointType=${supply.pointType}`

      console.log(`[datadis] consumption → ${consumptionUrl}`)
      const consumptionRes = await fetch(consumptionUrl, {
        headers: { authorization: authHeader, Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store',
      })
      console.log(`[datadis] consumption status: ${consumptionRes.status}`)
      if (consumptionRes.status === 429) {
        // If we have cached/DB data, return partial success instead of failing
        if (Object.keys(cachedData).length > 0) {
          console.log('[datadis] 429 on consumption, returning cached data only')
          const allData: Record<string, number> = {}
          for (const [ym, d] of Object.entries(cachedData)) {
            allData[ym] = (d as { kwh_total: number }).kwh_total
          }
          return NextResponse.json({
            ok: true,
            meses_sincronizados: 0,
            meses_desde_cache: Object.keys(cachedData).length,
            kwh_total: Object.values(allData).reduce((s, v) => s + v, 0),
            warning: 'Datos del mes actual no disponibles (límite Datadis), mostrando histórico',
          })
        }
        throw new Error('Datadis: límite de peticiones, intenta en unos minutos')
      }
      if (!consumptionRes.ok) throw new Error(`Consumption fetch failed: ${consumptionRes.status}`)

      const readings: Array<{ date: string; time: string; consumptionKWh: number }> =
        await consumptionRes.json()

      if (Array.isArray(readings) && readings.length > 0) {
        // Group readings by month
        const byMonth: Record<string, Array<{ date: string; time: string; consumptionKWh: number }>> = {}
        for (const r of readings) {
          const ym = monthToDbKey(r.date.slice(0, 7))
          if (!byMonth[ym]) byMonth[ym] = []
          byMonth[ym].push(r)
        }

        // Save each month as a file and build newData
        for (const [ym, monthReadings] of Object.entries(byMonth)) {
          const kwh_total = Math.round(monthReadings.reduce((s, r) => s + r.consumptionKWh, 0) * 100) / 100
          const fileContent = {
            synced_at: new Date().toISOString(),
            cups,
            year_month: ym,
            distributor_code: supply.distributorCode,
            point_type: supply.pointType,
            kwh_total,
            readings: monthReadings,
          }
          await saveStoredFile(supabase, clienteId, cups, ym, fileContent)
          newData[ym] = { readings: monthReadings, kwh_total }
        }
      }
    }

    // Merge cached + new for monthly upsert
    const allData: Record<string, number> = {}
    for (const [ym, d] of Object.entries(cachedData)) {
      allData[ym] = (d as { kwh_total: number }).kwh_total
    }
    for (const [ym, d] of Object.entries(newData)) {
      allData[ym] = d.kwh_total
    }

    if (Object.keys(allData).length > 0) {
      const rows = Object.entries(allData).map(([ym, kwh]) => ({
        cliente_id:     clienteId,
        cups,
        year_month:     ym,
        kwh_total:      kwh,
        fecha_consulta: new Date().toISOString(),
      }))

      const { error: upsertError } = await supabase
        .from('consumos_datadis')
        .upsert(rows, { onConflict: 'cliente_id,cups,year_month' })

      if (upsertError) throw new Error(`Supabase upsert: ${upsertError.message}`)
    }

    await supabase.from('clientes')
      .update({ ultima_sync_datadis: new Date().toISOString() })
      .eq('id', clienteId)

    return NextResponse.json({
      ok: true,
      meses_sincronizados: Object.keys(newData).length,
      meses_desde_cache: totalCached,
      kwh_total: Object.values(allData).reduce((s, v) => s + v, 0),
    })

  } catch (err) {
    console.error('[datadis/sync]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
