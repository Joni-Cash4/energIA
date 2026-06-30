import { NextResponse } from 'next/server'

const BASE = 'https://datadis.es'

async function getToken(): Promise<string> {
  const body = new URLSearchParams({
    username: process.env.DATADIS_USERNAME ?? '',
    password: process.env.DATADIS_PASSWORD ?? '',
  })
  const res = await fetch(`${BASE}/nikola-auth/tokens/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`Auth Datadis ${res.status}: ${await res.text()}`)
  return res.text()
}

async function getSupplies(token: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${BASE}/api-private/api/get-supplies?isDelegate=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Datadis supplies ${res.status}`)
  return res.json()
}

async function getConsumption(
  token: string, cups: string, distributorCode: string, authorizedNif?: string
): Promise<Record<string, unknown>[]> {
  const end = new Date()
  const start = new Date()
  start.setMonth(start.getMonth() - 13)
  const fmt = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`

  const params = new URLSearchParams({
    cups,
    distributorCode,
    startDate: fmt(start),
    endDate: fmt(end),
    measurementType: '0',
    pointType: '5',
    isDelegate: 'true',
  })
  if (authorizedNif) params.set('authorizedNif', authorizedNif)

  const res = await fetch(`${BASE}/api-private/api/get-consumption-data?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Datadis consumption ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function POST(req: Request) {
  try {
    const { cups, clienteId, nif } = await req.json() as {
      cups: string; clienteId: string; nif?: string
    }

    if (!cups || !clienteId) {
      return NextResponse.json({ error: 'cups y clienteId requeridos' }, { status: 400 })
    }
    if (!process.env.DATADIS_USERNAME || !process.env.DATADIS_PASSWORD) {
      return NextResponse.json({ error: 'Credenciales Datadis no configuradas en el servidor' }, { status: 500 })
    }
    // DEBUG TEMPORAL — verificar que los env vars lleguen completos
    const pwdLen = process.env.DATADIS_PASSWORD.length
    const userLen = process.env.DATADIS_USERNAME.length
    const pwdHasAmpersand = process.env.DATADIS_PASSWORD.includes('&')
    console.log(`[datadis] user len=${userLen} pwd len=${pwdLen} has&=${pwdHasAmpersand}`)
    if (pwdLen < 10) {
      return NextResponse.json({
        error: `DEBUG: password en Vercel parece truncada (${pwdLen} chars). Contiene &: ${pwdHasAmpersand}. Re-configura DATADIS_PASSWORD en Vercel.`,
        debug: { userLen, pwdLen, pwdHasAmpersand }
      }, { status: 500 })
    }

    const token = await getToken()

    // Buscar el CUPS para obtener distributorCode
    const supplies = await getSupplies(token)
    const supply = supplies.find((s) => String(s.cups).trim() === cups.trim())

    if (!supply) {
      return NextResponse.json({
        error: `CUPS ${cups} no encontrado en tu cuenta Datadis. Comprueba que el cliente tiene acceso delegado activo.`,
        cups_encontrados: supplies.map((s) => s.cups),
      }, { status: 404 })
    }

    const distributorCode = String(supply.distributorCode ?? '2')

    // Consumo mensual últimos 13 meses
    const raw = await getConsumption(token, cups, distributorCode, nif)

    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({
        error: 'Datadis no devolvió datos de consumo para este CUPS',
      }, { status: 404 })
    }

    // date "2026/01" → year_month "2026-01"
    const consumos = raw
      .filter((c) => Number(c.consumptionKWh ?? 0) > 0)
      .map((c) => ({
        cliente_id: clienteId,
        cups,
        year_month: String(c.date ?? '').replace('/', '-'),
        kwh_total:  Number(c.consumptionKWh ?? 0),
      }))
      .filter((c) => c.year_month.length >= 7)

    return NextResponse.json({
      ok: true,
      consumos,
      meses_sincronizados: consumos.length,
      kwh_total: consumos.reduce((s, c) => s + c.kwh_total, 0),
    })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    console.error('[datadis/sync]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
