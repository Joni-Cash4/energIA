import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { getSupabaseServerClient } from '@/lib/supabase-server'

// Sincroniza mercado_perd desde ESIOS (archivo 70, PVPCDATA, campo COF2TD) en
// vez de depender del sistema Python local. Ver
// architecture/adr/0006-mercado-perd-desde-esios.md.
//
// Uso responsable — UNA petición por ejecución, para el mes calendario
// anterior completo, y solo si ese mes todavía no está guardado. El archivo
// 70 admite rango de fechas (start_date/end_date/date_type=datos) y devuelve
// un ZIP con un JSON por día — confirmado con pruebas reales 2026-07-26 (7 y
// 26 días en una sola petición, sin error).
//
// Fórmula: PERD = (1 + media(COF2TD del mes)) × 1.04 — igual que
// get_perd_por_periodo() en fuentes_mercado.py (sistema local). El mismo
// valor se aplica a las 3 tarifas × 6 periodos, tal cual hace hoy el script
// local (COF2TD no varía por tarifa/periodo en esta fuente).
//
// mercado_sc_cap (SC/CAP) queda FUERA de esta ruta a propósito: sus campos en
// el archivo 70 (SAHPCB, FOSPCB, PCAPPCB...) no se han contrastado todavía
// contra los indicadores sueltos que usa hoy el script local — pendiente.

const TARIFAS = ['2.0TD', '3.0TD', '6.1TD'] as const
const PERIODOS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const

function mesKey(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}`
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.ESIOS_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'ESIOS_TOKEN no configurado en Vercel' }, { status: 500 })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase server client no configurado' }, { status: 500 })
  }

  // Mes objetivo: el mes calendario anterior (ya cerrado del todo, para no
  // guardar una media parcial de un mes en curso).
  const hoy = new Date()
  const objetivo = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  const año = objetivo.getFullYear()
  const mes = objetivo.getMonth() + 1
  const mes_key = mesKey(año, mes)

  const { data: existente, error: errExistente } = await supabase
    .from('mercado_perd')
    .select('mes')
    .eq('mes', mes_key)
    .limit(1)
    .maybeSingle()

  if (errExistente) {
    return NextResponse.json({ error: errExistente.message }, { status: 500 })
  }
  if (existente) {
    return NextResponse.json({ ok: true, message: `${mes_key} ya estaba guardado — no se ha llamado a ESIOS.` })
  }

  // Una única petición, rango del mes completo.
  const ultimoDia = new Date(año, mes, 0).getDate()
  const start = `${mes_key}-01T00:00:00`
  const end = `${mes_key}-${String(ultimoDia).padStart(2, '0')}T23:59:59`
  const url = `https://api.esios.ree.es/archives/70/download_json?start_date=${start}&end_date=${end}&date_type=datos`

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json; application/vnd.esios-api-v2+json',
      'x-api-key': token,
    },
  })

  if (!res.ok) {
    return NextResponse.json({ error: `ESIOS respondió ${res.status}`, mes: mes_key }, { status: 502 })
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  const zip = await JSZip.loadAsync(buffer)

  const cof2tdValores: number[] = []
  for (const filename of Object.keys(zip.files)) {
    const entry = zip.files[filename]
    if (entry.dir || !filename.endsWith('.json')) continue
    const contenido = await entry.async('string')
    const parsed = JSON.parse(contenido)
    const registros: Record<string, string>[] = parsed?.PVPC ?? []
    for (const r of registros) {
      const v = parseFloat((r.COF2TD ?? '').replace(',', '.'))
      if (!isNaN(v)) cof2tdValores.push(v)
    }
  }

  if (cof2tdValores.length === 0) {
    return NextResponse.json({ error: 'ESIOS no devolvió registros COF2TD para ese mes', mes: mes_key }, { status: 502 })
  }

  const mediaCof2td = cof2tdValores.reduce((s, v) => s + v, 0) / cof2tdValores.length
  const perd = Math.round((1 + mediaCof2td) * 1.04 * 1e6) / 1e6

  const filas = TARIFAS.flatMap((tarifa) => PERIODOS.map((periodo) => ({ mes: mes_key, tarifa, periodo, perd })))

  const { error } = await supabase.from('mercado_perd').upsert(filas, { onConflict: 'mes,tarifa,periodo' })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    mes: mes_key,
    perd,
    registros_cof2td: cof2tdValores.length,
    filas_guardadas: filas.length,
  })
}
