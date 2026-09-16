import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

// Sincroniza mercado_pmd_diario desde la API oficial de ESIOS (indicador 600,
// "Precio mercado SPOT Diario") en vez de depender del sistema Python local de
// Jonathan para este dato. Ver architecture/adr/0005-datos-mercado-desde-esios.md.
//
// Uso responsable obligatorio — ESIOS ya bloqueó este token una vez por
// peticiones masivas/redundantes. Reglas de esta ruta, no opcionales:
//   1. Como mucho UNA petición a ESIOS por ejecución.
//   2. Se pide desde el día más antiguo que falte hasta ayer (como mucho 31 días),
//      nunca un día que ya esté guardado. Si un día falla, la ejecución siguiente
//      lo recupera junto con el resto en esa misma única petición. Antes solo se
//      pedía un día y, desde que se retrasó una vez, iba siempre dos días por detrás
//      (ADR-0012).
//   3. Si ya está todo al día, no se llama a ESIOS en absoluto.
//   4. Solo se guardan días completos y seguidos: si uno llega incompleto, se para
//      ahí y se vuelve a pedir en la siguiente ejecución (la tabla no puede tener
//      huecos, porque el día objetivo es el último guardado + 1).

// ESIOS devolvió 504 a una sola petición de 19 meses (2026-09-15); 31 días quedan muy
// lejos de eso. En uso normal se piden 1 o 2 días.
const MAX_DIAS = 31

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
  const desdeStr = fechaStr(objetivo)

  if (desdeStr > ayerStr) {
    return NextResponse.json({ ok: true, message: 'Ya al día — no se ha llamado a ESIOS.' })
  }

  const tope = new Date(objetivo)
  tope.setDate(tope.getDate() + MAX_DIAS - 1)
  const hastaStr = fechaStr(tope) < ayerStr ? fechaStr(tope) : ayerStr

  // 2. Una única petición a ESIOS, del día más antiguo que falte hasta ayer.
  const url = `https://api.esios.ree.es/indicators/600?start_date=${desdeStr}T00:00:00&end_date=${hastaStr}T23:59:00&geo_ids%5B%5D=3`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json; application/vnd.esios-api-v2+json',
      'x-api-key': token,
    },
  })

  if (!res.ok) {
    return NextResponse.json({ error: `ESIOS respondió ${res.status}`, desde: desdeStr, hasta: hastaStr }, { status: 502 })
  }

  const json = await res.json()
  const valores: EsiosValor[] = json?.indicator?.values ?? []
  // Se filtra igual aunque la URL ya pida geo_id 3, por si ESIOS ignorase el filtro.
  const espana = valores.filter((v) => v.geo_id === 3)

  if (espana.length === 0) {
    return NextResponse.json({ error: 'ESIOS no devolvió datos de España para ese rango', desde: desdeStr, hasta: hastaStr }, { status: 502 })
  }

  // 3. Agrupar por día y hora local (0-23) y promediar los cuartos de hora — misma
  // semántica que ya usa la tabla (ver api/market-historical/route.ts, fetchOmieDia).
  const porDia = new Map<string, Map<number, number[]>>()
  for (const v of espana) {
    const dia = v.datetime.slice(0, 10)
    const hora = Number(v.datetime.slice(11, 13))
    const horas = porDia.get(dia) ?? new Map<number, number[]>()
    const lista = horas.get(hora) ?? []
    lista.push(v.value)
    horas.set(hora, lista)
    porDia.set(dia, horas)
  }

  // 4. Solo días completos (23-25 horas locales, según cambio de hora) y seguidos
  // desde el primero que faltaba.
  const filas: { fecha: string; hora: number; precio_mwh: number }[] = []
  const dias: string[] = []
  let incompleto: string | null = null
  for (let d = new Date(objetivo); fechaStr(d) <= hastaStr; d.setDate(d.getDate() + 1)) {
    const dia = fechaStr(d)
    const horas = porDia.get(dia)
    if (!horas || horas.size < 23) { incompleto = dia; break }
    for (const [hora, precios] of horas) {
      filas.push({
        fecha: dia,
        hora,
        precio_mwh: Math.round((precios.reduce((s, p) => s + p, 0) / precios.length) * 100) / 100,
      })
    }
    dias.push(dia)
  }

  if (filas.length > 0) {
    const { error } = await supabase.from('mercado_pmd_diario').upsert(filas, { onConflict: 'fecha,hora' })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    ok: true,
    desde: desdeStr,
    hasta: hastaStr,
    dias_guardados: dias.length,
    horas_guardadas: filas.length,
    ...(incompleto ? { parado_en: incompleto, motivo: 'día incompleto en ESIOS, se reintenta en la siguiente ejecución' } : {}),
  })
}
