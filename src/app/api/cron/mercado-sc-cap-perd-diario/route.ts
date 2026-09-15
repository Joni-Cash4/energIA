import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { getSupabaseServerClient } from '@/lib/supabase-server'

// Sincroniza mercado_sc_cap_perd_diario: SC, CAP y PERD de cada DÍA, de ESIOS PVPCDATA
// (archivo 70). Mismo cálculo que el cron mensual mercado-perd-sync, pero por día, para
// calcular cada factura con sus días exactos en vez de con el mes de fecha_inicio (ver
// supabase/migrations/mercado_sc_cap_perd_diario.sql y ADR-0006):
//   SC   = media del día de (SAHPCB + FOMPCB + FOSPCB + INTPCB + EDSRPCB) / 1000  €/kWh
//   CAP  = media del día de PCAPPCB / 1000                                     €/kWh
//   PERD = (1 + media del día de COF2TD) × 1,04
//
// Uso responsable — mismas reglas que mercado-pmd-sync (ADR-0005), no opcionales:
//   1. Como mucho UNA petición a ESIOS por ejecución.
//   2. Desde el día más antiguo que falte hasta ayer, como mucho 31 días. El archivo 70
//      admite rango y devuelve un ZIP con un JSON por día (probado con 16 meses de una vez).
//   3. Si ya está todo al día, no se llama a ESIOS.
//   4. Solo se guardan días completos y seguidos; si uno llega incompleto, se para ahí y
//      se vuelve a pedir en la siguiente ejecución.

const MAX_DIAS = 31

function fechaStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseNum(s: string | undefined): number | null {
  if (s == null) return null
  const v = parseFloat(String(s).replace(',', '.'))
  return isNaN(v) ? null : v
}

// Día del registro: campo Dia (dd/mm/aaaa) o, si no viene, la fecha del nombre del fichero.
function diaDe(r: Record<string, string>, fichero: string): string | null {
  const d = String(r.Dia ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (d) return `${d[3]}-${d[2]}-${d[1]}`
  const f = fichero.match(/(\d{4})-?(\d{2})-?(\d{2})/)
  return f ? `${f[1]}-${f[2]}-${f[3]}` : null
}

const media = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
const r6 = (x: number) => Math.round(x * 1e6) / 1e6

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

  // 1. Día más reciente ya guardado.
  const { data: ultimo, error: errUltimo } = await supabase
    .from('mercado_sc_cap_perd_diario')
    .select('fecha')
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (errUltimo) {
    return NextResponse.json({ error: errUltimo.message }, { status: 500 })
  }

  const hoy = new Date()
  const ayer = new Date(hoy)
  ayer.setDate(hoy.getDate() - 1)
  const ayerStr = fechaStr(ayer)

  let objetivo: Date
  if (ultimo?.fecha) {
    objetivo = new Date(ultimo.fecha + 'T00:00:00')
    objetivo.setDate(objetivo.getDate() + 1)
  } else {
    objetivo = new Date(ayer)
  }
  const desdeStr = fechaStr(objetivo)

  if (desdeStr > ayerStr) {
    return NextResponse.json({ ok: true, message: 'Ya al día — no se ha llamado a ESIOS.' })
  }

  const tope = new Date(objetivo)
  tope.setDate(tope.getDate() + MAX_DIAS - 1)
  const hastaStr = fechaStr(tope) < ayerStr ? fechaStr(tope) : ayerStr

  // 2. Una única petición, rango del día más antiguo que falte hasta ayer.
  const url = `https://api.esios.ree.es/archives/70/download_json?start_date=${desdeStr}T00:00:00&end_date=${hastaStr}T23:59:59&date_type=datos`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json; application/vnd.esios-api-v2+json',
      'x-api-key': token,
    },
  })

  if (!res.ok) {
    return NextResponse.json({ error: `ESIOS respondió ${res.status}`, desde: desdeStr, hasta: hastaStr }, { status: 502 })
  }

  const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()))
  const porDia = new Map<string, { cof: number[]; sc: number[]; cap: number[] }>()
  for (const [nombre, entry] of Object.entries(zip.files)) {
    if (entry.dir || !nombre.endsWith('.json')) continue
    const registros: Record<string, string>[] = JSON.parse(await entry.async('string'))?.PVPC ?? []
    for (const r of registros) {
      const dia = diaDe(r, nombre)
      if (!dia) continue
      const m = porDia.get(dia) ?? { cof: [], sc: [], cap: [] }
      const cof = parseNum(r.COF2TD)
      if (cof != null) m.cof.push(cof)
      const c = [r.SAHPCB, r.FOMPCB, r.FOSPCB, r.INTPCB, r.EDSRPCB].map(parseNum)
      if (c.every((v) => v != null)) m.sc.push((c as number[]).reduce((s, v) => s + v, 0))
      const cap = parseNum(r.PCAPPCB)
      if (cap != null) m.cap.push(cap)
      porDia.set(dia, m)
    }
  }

  // 3. Solo días completos (23-25 horas, según cambio de hora) y seguidos.
  const filas: { fecha: string; sc: number; cap: number; perd: number }[] = []
  let incompleto: string | null = null
  for (let d = new Date(objetivo); fechaStr(d) <= hastaStr; d.setDate(d.getDate() + 1)) {
    const dia = fechaStr(d)
    const m = porDia.get(dia)
    if (!m || m.cof.length < 23 || m.sc.length < 23 || m.cap.length < 23) { incompleto = dia; break }
    filas.push({
      fecha: dia,
      sc: r6(media(m.sc) / 1000),
      cap: r6(media(m.cap) / 1000),
      perd: r6((1 + media(m.cof)) * 1.04),
    })
  }

  if (filas.length > 0) {
    const { error } = await supabase.from('mercado_sc_cap_perd_diario').upsert(filas, { onConflict: 'fecha' })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    ok: true,
    desde: desdeStr,
    hasta: hastaStr,
    dias_guardados: filas.length,
    ...(incompleto ? { parado_en: incompleto, motivo: 'día incompleto en ESIOS, se reintenta en la siguiente ejecución' } : {}),
  })
}
