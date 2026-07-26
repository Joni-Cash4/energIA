import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

// Sincroniza mercado_pmd_diario desde la API oficial de ESIOS (indicador 600,
// "Precio mercado SPOT Diario") en vez de depender del sistema Python local de
// Jonathan para este dato. Ver architecture/adr/0005-datos-mercado-desde-esios.md.
//
// Uso responsable obligatorio — ESIOS ya bloqueó este token una vez por
// peticiones masivas/redundantes. Reglas de esta ruta, no opcionales:
//   1. Como mucho UNA petición a ESIOS por ejecución.
//   2. Solo se pide el día más antiguo que falte en la tabla — nunca un día
//      que ya esté guardado.
//   3. Si ya está todo al día, no se llama a ESIOS en absoluto.

function fechaStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface EsiosValor {
  value: number
  datetime: string // '2026-07-25T00:00:00.000+02:00' — hora local España ya resuelta
  geo_id: number
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

  // 1. Día más reciente ya guardado en la tabla.
  const { data: ultimo, error: errUltimo } = await supabase
    .from('mercado_pmd_diario')
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
    // Tabla vacía: no se adivina cuánto retroceder, se arranca en el día de ayer.
    objetivo = new Date(ayer)
  }
  const objetivoStr = fechaStr(objetivo)

  if (objetivoStr > ayerStr) {
    return NextResponse.json({ ok: true, message: 'Ya al día — no se ha llamado a ESIOS.' })
  }

  // 2. Una única petición a ESIOS, para ese día exacto.
  const url = `https://api.esios.ree.es/indicators/600?start_date=${objetivoStr}T00:00:00&end_date=${objetivoStr}T23:59:00`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json; application/vnd.esios-api-v2+json',
      'x-api-key': token,
    },
  })

  if (!res.ok) {
    return NextResponse.json({ error: `ESIOS respondió ${res.status}`, fecha: objetivoStr }, { status: 502 })
  }

  const json = await res.json()
  const valores: EsiosValor[] = json?.indicator?.values ?? []
  const espana = valores.filter((v) => v.geo_id === 3)

  if (espana.length === 0) {
    return NextResponse.json({ error: 'ESIOS no devolvió datos de España para ese día', fecha: objetivoStr }, { status: 502 })
  }

  // 3. Agrupar los cuartos de hora en horas (0-23) y promediar — misma
  // semántica que ya usa la tabla (ver api/market-historical/route.ts,
  // fetchOmieDia: varias filas del mismo día se promedian por periodo).
  const porHora = new Map<number, number[]>()
  for (const v of espana) {
    const hora = Number(v.datetime.slice(11, 13))
    const lista = porHora.get(hora) ?? []
    lista.push(v.value)
    porHora.set(hora, lista)
  }

  const filas = Array.from(porHora.entries()).map(([hora, precios]) => ({
    fecha: objetivoStr,
    hora,
    precio_mwh: Math.round((precios.reduce((s, p) => s + p, 0) / precios.length) * 100) / 100,
  }))

  const { error } = await supabase.from('mercado_pmd_diario').upsert(filas, { onConflict: 'fecha,hora' })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, fecha: objetivoStr, horas_guardadas: filas.length })
}
