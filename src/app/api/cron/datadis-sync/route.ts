import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DATADIS_BASE = 'https://datadis.es'
const DATADIS_USER = process.env.DATADIS_USERNAME!
const DATADIS_PASS = process.env.DATADIS_PASSWORD!
const BUCKET = 'datadis-raw'

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
function monthToDbKey(m: string) { return m.replace('/', '-') }

function currentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
}

async function getToken(): Promise<string> {
  const res = await fetch(`${DATADIS_BASE}/nikola-auth/tokens/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: DATADIS_USER, password: DATADIS_PASS }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Datadis login failed: ${res.status}`)
  const token = (await res.text()).replace(/"/g, '')
  if (!token) throw new Error('Datadis login returned empty token')
  return token
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Clientes con CUPS y autorización Datadis
  const { data: clientes, error } = await supabase
    .from('clientes')
    .select('id, cups, nif')
    .not('cups', 'is', null)
    .neq('cups', '')
    .not('autorizacion_datadis', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!clientes?.length) return NextResponse.json({ synced: 0, message: 'Sin clientes con CUPS autorizado' })

  const currentMonth = monthToDbKey(currentYearMonth())
  const SIX_HOURS = 6 * 60 * 60 * 1000

  // Un solo login para toda la ejecución del cron
  let token: string
  try {
    token = await getToken()
  } catch (err) {
    return NextResponse.json({ error: `Login Datadis: ${err}` }, { status: 500 })
  }
  const authHeaderVal = `Bearer ${token}`

  const results: Array<{ cups: string; status: string; error?: string }> = []

  for (const cliente of clientes) {
    const { id: clienteId, cups, nif } = cliente

    try {
      // Comprobar si el mes actual ya fue sincronizado en las últimas 6h
      const { data: existing } = await supabase
        .from('consumos_datadis')
        .select('fecha_consulta')
        .eq('cliente_id', clienteId)
        .eq('cups', cups)
        .eq('year_month', currentMonth)
        .maybeSingle()

      if (existing?.fecha_consulta) {
        const age = Date.now() - new Date(existing.fecha_consulta).getTime()
        if (age < SIX_HOURS) {
          results.push({ cups, status: 'skipped (fresh)' })
          continue
        }
      }

      // Determinar si es suministro propio o de tercero
      const isOwnSupply = !nif || nif === DATADIS_USER
      const suppliesUrl = isOwnSupply
        ? `${DATADIS_BASE}/api-private/api/get-supplies`
        : `${DATADIS_BASE}/api-private/api/get-supplies-v2?authorizedNif=${encodeURIComponent(nif)}`

      await sleep(2000)
      const suppliesRes = await fetch(suppliesUrl, {
        headers: { authorization: authHeaderVal, Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store',
      })

      if (suppliesRes.status === 429) {
        results.push({ cups, status: 'skipped (429 supplies)' })
        await sleep(10000)
        continue
      }
      if (!suppliesRes.ok) {
        results.push({ cups, status: `error supplies ${suppliesRes.status}` })
        continue
      }

      const supplies: Array<{ cups: string; distributorCode: number; pointType: number }> =
        await suppliesRes.json()
      const supply = Array.isArray(supplies) ? supplies.find(s => s.cups === cups) : null
      if (!supply) {
        results.push({ cups, status: 'CUPS no encontrado en Datadis' })
        continue
      }

      await sleep(5000)
      const consumptionRes = await fetch(
        `${DATADIS_BASE}/api-private/api/get-consumption-data` +
        `?cups=${encodeURIComponent(cups)}` +
        `&distributorCode=${supply.distributorCode}` +
        `&startDate=${currentYearMonth()}` +
        `&endDate=${currentYearMonth()}` +
        `&measurementType=0` +
        `&pointType=${supply.pointType}`,
        {
          headers: { authorization: authHeaderVal, Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
          cache: 'no-store',
        },
      )

      if (consumptionRes.status === 429) {
        results.push({ cups, status: 'skipped (429 consumption)' })
        await sleep(15000)
        continue
      }
      if (!consumptionRes.ok) {
        results.push({ cups, status: `error consumption ${consumptionRes.status}` })
        continue
      }

      const readings: Array<{ date: string; time: string; consumptionKWh: number }> =
        await consumptionRes.json()

      if (!Array.isArray(readings) || readings.length === 0) {
        results.push({ cups, status: 'sin lecturas' })
        continue
      }

      const kwh_total = Math.round(readings.reduce((s, r) => s + r.consumptionKWh, 0) * 100) / 100

      // Guardar fichero JSON en Storage
      const path = `${clienteId}/${cups}/${currentMonth}.json`
      const blob = new Blob([JSON.stringify({
        synced_at: new Date().toISOString(),
        cups,
        year_month: currentMonth,
        distributor_code: supply.distributorCode,
        point_type: supply.pointType,
        kwh_total,
        readings,
      })], { type: 'application/json' })
      await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true })

      // Actualizar BD
      await supabase.from('consumos_datadis').upsert(
        [{ cliente_id: clienteId, cups, year_month: currentMonth, kwh_total, fecha_consulta: new Date().toISOString() }],
        { onConflict: 'cliente_id,cups,year_month' },
      )
      await supabase.from('clientes')
        .update({ ultima_sync_datadis: new Date().toISOString() })
        .eq('id', clienteId)

      results.push({ cups, status: `ok (${kwh_total} kWh)` })
    } catch (err) {
      results.push({ cups, status: 'exception', error: String(err) })
    }

    // Pausa entre clientes para no saturar Datadis
    await sleep(10000)
  }

  console.log('[cron/datadis-sync]', results)
  return NextResponse.json({ synced: results.filter(r => r.status.startsWith('ok')).length, results })
}
