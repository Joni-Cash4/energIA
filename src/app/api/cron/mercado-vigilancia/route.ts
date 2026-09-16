import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'

// Vigila que las tablas de mercado estén al día y avisa por Telegram si no.
// Corre después de los crons que las rellenan (mercado-pmd-sync 5:30,
// mercado-sc-cap-perd-diario 6:15, mercado-perd-sync el día 2) y no llama a ESIOS:
// solo lee Supabase. Si todo está bien no envía nada.
//
// Comprueba:
//   - mercado_pmd_diario: los últimos DIAS_REVISADOS días hasta ayer, cada uno con 23-25 horas.
//   - mercado_sc_cap_perd_diario: los mismos días, todos presentes.
//   - mercado_sc_cap y mercado_perd: el mes anterior, a partir del día 3.
// Un fallo de un día se ve aquí aunque el cron se ponga al día solo después.

const DIAS_REVISADOS = 7

function fechaStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function resumen(dias: string[]): string {
  return dias.length <= 3 ? dias.join(', ') : `${dias[0]} … ${dias[dias.length - 1]} (${dias.length} días)`
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase server client no configurado' }, { status: 500 })
  }

  const hoy = new Date()
  const dias: string[] = []
  for (let i = DIAS_REVISADOS; i >= 1; i--) {
    const d = new Date(hoy)
    d.setDate(hoy.getDate() - i)
    dias.push(fechaStr(d))
  }
  const desde = dias[0]
  const hasta = dias[dias.length - 1]
  const problemas: string[] = []

  // 1. PMD horario: cada día con 23-25 horas.
  const { data: pmd, error: errPmd } = await supabase
    .from('mercado_pmd_diario')
    .select('fecha')
    .gte('fecha', desde)
    .lte('fecha', hasta)
  if (errPmd) {
    problemas.push(`PMD: no se pudo leer la tabla (${errPmd.message})`)
  } else {
    const horas = new Map<string, number>()
    for (const r of pmd ?? []) horas.set(r.fecha, (horas.get(r.fecha) ?? 0) + 1)
    const faltan = dias.filter((d) => (horas.get(d) ?? 0) < 23)
    if (faltan.length) problemas.push(`PMD (mercado-pmd-sync): faltan o están incompletos ${resumen(faltan)}`)
  }

  // 2. SC, CAP y PERD por día: todos presentes.
  const { data: sc, error: errSc } = await supabase
    .from('mercado_sc_cap_perd_diario')
    .select('fecha')
    .gte('fecha', desde)
    .lte('fecha', hasta)
  if (errSc) {
    problemas.push(`SC/CAP/PERD diario: no se pudo leer la tabla (${errSc.message})`)
  } else {
    const hay = new Set((sc ?? []).map((r) => r.fecha))
    const faltan = dias.filter((d) => !hay.has(d))
    if (faltan.length) problemas.push(`SC/CAP/PERD diario (mercado-sc-cap-perd-diario): faltan ${resumen(faltan)}`)
  }

  // 3. Tablas mensuales: el mes anterior, desde el día 3 (el cron corre el día 2).
  if (hoy.getDate() >= 3) {
    const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    const mes = fechaStr(anterior).slice(0, 7)
    const [scCap, perd] = await Promise.all([
      supabase.from('mercado_sc_cap').select('mes').eq('mes', mes).maybeSingle(),
      supabase.from('mercado_perd').select('mes').eq('mes', mes).limit(1),
    ])
    if (scCap.error || !scCap.data) problemas.push(`SC/CAP mensual (mercado-perd-sync): falta ${mes}`)
    if (perd.error || !perd.data?.length) problemas.push(`PERD mensual (mercado-perd-sync): falta ${mes}`)
  }

  if (problemas.length === 0) {
    return NextResponse.json({ ok: true, revisado: { desde, hasta }, problemas })
  }

  // Sin aviso no sirve de nada: si no se puede enviar, el cron lo devuelve como error.
  const chatId = Number(process.env.TELEGRAM_ALLOWED_CHAT_ID)
  const texto = [
    '⚠️ Datos de mercado sin actualizar',
    ...problemas.map((p) => `• ${p}`),
    '',
    'Mientras falten, las facturas de esos días usan el valor del mes o una estimación.',
  ].join('\n')
  try {
    if (!chatId) throw new Error('TELEGRAM_ALLOWED_CHAT_ID no configurado')
    await sendTelegramMessage(chatId, texto)
  } catch (err) {
    return NextResponse.json(
      { ok: false, problemas, error: `No se pudo avisar por Telegram: ${(err as Error).message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: false, revisado: { desde, hasta }, problemas, avisado: true })
}
