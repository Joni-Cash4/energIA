import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { getSupabaseServerClient } from '@/lib/supabase-server'

// Sincroniza mercado_perd Y mercado_sc_cap desde ESIOS (archivo 70, PVPCDATA)
// en vez de depender del sistema Python local. Ver
// architecture/adr/0006-mercado-perd-desde-esios.md (cierre 2026-07-26).
//
// Uso responsable — UNA petición por ejecución, para el mes calendario
// anterior completo, y solo si ese mes todavía no está guardado. El archivo
// 70 admite rango de fechas (start_date/end_date/date_type=datos) y devuelve
// un ZIP con un JSON por día — confirmado con pruebas reales 2026-07-26 (7 y
// 26 días en una sola petición, sin error).
//
// PERD: (1 + media(COF2TD del mes)) × 1.04 — igual que get_perd_por_periodo()
// en fuentes_mercado.py (sistema local). Mismo valor para las 3 tarifas × 6
// periodos (COF2TD no varía por tarifa/periodo en esta fuente).
//
// SC/CAP: hasta 2026-07-26 se calculaban en el sistema local con los
// indicadores sueltos de ESIOS (IDs 1739-1746) SIN filtrar por geo_id — un
// bug real confirmado con datos: esos indicadores no devuelven ninguna fila
// de España/península, solo Ceuta/Melilla/Canarias/Baleares, así que
// mercado_sc_cap llevaba meses con SC/CAP calculados a partir de recargos de
// sistemas insulares/extrapeninsulares. El archivo 70 (PVPCDATA) es
// explícitamente el dato peninsular, sin esa ambigüedad — se usa como única
// fuente, reutilizando la misma descarga mensual que ya hace este cron para
// PERD (cero peticiones extra a ESIOS):
//   SC  = SAHPCB + FOMPCB + FOSPCB + INTPCB + EDSRPCB  (EUR/MWh → /1000 EUR/kWh)
//   CAP = PCAPPCB                                       (EUR/MWh → /1000 EUR/kWh)

const TARIFAS = ['2.0TD', '3.0TD', '6.1TD'] as const
const PERIODOS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const

function parseNum(s: string | undefined): number | null {
  if (s == null) return null
  const v = parseFloat(s.replace(',', '.'))
  return isNaN(v) ? null : v
}

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

  const [{ data: existentePerd, error: errPerd }, { data: existenteScCap, error: errScCap }] = await Promise.all([
    supabase.from('mercado_perd').select('mes').eq('mes', mes_key).limit(1).maybeSingle(),
    supabase.from('mercado_sc_cap').select('mes').eq('mes', mes_key).limit(1).maybeSingle(),
  ])

  if (errPerd) return NextResponse.json({ error: errPerd.message }, { status: 500 })
  if (errScCap) return NextResponse.json({ error: errScCap.message }, { status: 500 })
  if (existentePerd && existenteScCap) {
    return NextResponse.json({ ok: true, message: `${mes_key} ya estaba guardado (perd + sc_cap) — no se ha llamado a ESIOS.` })
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
  const scValoresMwh: number[] = []
  const capValoresMwh: number[] = []
  for (const filename of Object.keys(zip.files)) {
    const entry = zip.files[filename]
    if (entry.dir || !filename.endsWith('.json')) continue
    const contenido = await entry.async('string')
    const parsed = JSON.parse(contenido)
    const registros: Record<string, string>[] = parsed?.PVPC ?? []
    for (const r of registros) {
      const cof2td = parseNum(r.COF2TD)
      if (cof2td != null) cof2tdValores.push(cof2td)

      const sah = parseNum(r.SAHPCB)
      const fom = parseNum(r.FOMPCB)
      const fos = parseNum(r.FOSPCB)
      const int_ = parseNum(r.INTPCB)
      const edsr = parseNum(r.EDSRPCB)
      if (sah != null && fom != null && fos != null && int_ != null && edsr != null) {
        scValoresMwh.push(sah + fom + fos + int_ + edsr)
      }

      const cap = parseNum(r.PCAPPCB)
      if (cap != null) capValoresMwh.push(cap)
    }
  }

  if (cof2tdValores.length === 0) {
    return NextResponse.json({ error: 'ESIOS no devolvió registros COF2TD para ese mes', mes: mes_key }, { status: 502 })
  }

  const mediaCof2td = cof2tdValores.reduce((s, v) => s + v, 0) / cof2tdValores.length
  const perd = Math.round((1 + mediaCof2td) * 1.04 * 1e6) / 1e6

  const filasPerd = TARIFAS.flatMap((tarifa) => PERIODOS.map((periodo) => ({ mes: mes_key, tarifa, periodo, perd })))

  const { error: errUpsertPerd } = await supabase.from('mercado_perd').upsert(filasPerd, { onConflict: 'mes,tarifa,periodo' })
  if (errUpsertPerd) {
    return NextResponse.json({ error: errUpsertPerd.message }, { status: 500 })
  }

  let sc: number | null = null
  let cap: number | null = null
  if (scValoresMwh.length > 0 && capValoresMwh.length > 0) {
    sc = Math.round((scValoresMwh.reduce((s, v) => s + v, 0) / scValoresMwh.length / 1000) * 1e6) / 1e6
    cap = Math.round((capValoresMwh.reduce((s, v) => s + v, 0) / capValoresMwh.length / 1000) * 1e6) / 1e6

    const { error: errUpsertScCap } = await supabase
      .from('mercado_sc_cap')
      .upsert([{ mes: mes_key, sc, cap }], { onConflict: 'mes' })
    if (errUpsertScCap) {
      return NextResponse.json({ error: errUpsertScCap.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    ok: true,
    mes: mes_key,
    perd,
    sc,
    cap,
    registros_cof2td: cof2tdValores.length,
    registros_sc_cap: scValoresMwh.length,
    filas_perd_guardadas: filasPerd.length,
  })
}
