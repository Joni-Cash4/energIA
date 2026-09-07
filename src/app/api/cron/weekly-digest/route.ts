import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { calcularComisionContrato } from '@/lib/comisiones'
import type { Contrato } from '@/types'

// Reutiliza exactamente los mismos filtros que ya usan dashboard/page.tsx,
// DashboardNav.tsx y dashboard/cartera/page.tsx — no se reinterpretan, para
// que el email nunca contradiga lo que Jonathan ve al abrir el dashboard.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase server client no configurado' }, { status: 500 })
  }

  const hoy = new Date().toISOString().split('T')[0]
  const since = new Date(); since.setDate(since.getDate() - 7)
  const en30 = new Date(); en30.setDate(en30.getDate() + 30)

  type CarteraFila = Pick<Contrato,
    'kwh_base_comision' | 'fee_energia_mwh' | 'kw_base_comision' | 'fee_potencia_mwh' | 'reparto_energia'
  >

  const [
    { count: renovacionesProximas },
    { count: gestionesVencidas },
    { count: cuotasSinVerificar },
    { count: contactosSinLeer },
    { count: leadsNuevos },
    { data: facturasSemana },
    { data: contratosActivos },
  ] = await Promise.all([
    // Sin límite inferior: un contrato vencido y sin verificar sigue contando
    // (antes desaparecía de la alerta en cuanto pasaba la fecha, en vez de escalar).
    supabase.from('contratos').select('id', { count: 'exact', head: true })
      .eq('estado', 'activo').eq('renovacion_verificada', false)
      .lte('fecha_vencimiento', en30.toISOString().split('T')[0]),
    supabase.from('gestiones').select('id', { count: 'exact', head: true })
      .neq('estado', 'resuelto').lte('proximo_seguimiento', hoy),
    supabase.from('comision_cobros').select('id', { count: 'exact', head: true })
      .eq('cobrado', false).eq('verificado_prefactura', false).lte('fecha_prevista', hoy),
    supabase.from('contactos').select('id', { count: 'exact', head: true }).eq('leido', false),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('estado', 'nuevo'),
    supabase.from('facturas').select('id, ahorro_estimado_anual').gte('created_at', since.toISOString()),
    supabase.from('contratos').select('kwh_base_comision,fee_energia_mwh,kw_base_comision,fee_potencia_mwh,reparto_energia').eq('estado', 'activo'),
  ])

  const facturas7d = facturasSemana?.length ?? 0
  const ahorro7d = (facturasSemana ?? []).reduce((s, f) => s + (f.ahorro_estimado_anual ?? 0), 0)
  const filasCartera = (contratosActivos ?? []) as CarteraFila[]
  const comisionAnual = filasCartera.reduce((s, f) => s + (calcularComisionContrato(f) ?? 0), 0)
  const contratosConDatos = filasCartera.filter(f => calcularComisionContrato(f) != null).length

  const alertas = [
    renovacionesProximas ? { texto: `${renovacionesProximas} contrato${renovacionesProximas === 1 ? '' : 's'} por renovar (vencido${renovacionesProximas === 1 ? '' : 's'} o en 30 días)`, href: '/dashboard/contratos' } : null,
    gestionesVencidas ? { texto: `${gestionesVencidas} ${gestionesVencidas === 1 ? 'gestión' : 'gestiones'} con seguimiento vencido`, href: '/dashboard/gestiones' } : null,
    cuotasSinVerificar ? { texto: `${cuotasSinVerificar} cuota${cuotasSinVerificar === 1 ? '' : 's'} de cobro sin verificar contra su prefactura`, href: '/dashboard/cobros' } : null,
    contactosSinLeer ? { texto: `${contactosSinLeer} mensaje${contactosSinLeer === 1 ? '' : 's'} web sin leer`, href: '/dashboard/contactos' } : null,
  ].filter((a): a is { texto: string; href: string } => a !== null)

  const alertasHtml = alertas.length
    ? alertas.map(a => `
      <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:#1A1A0A;border:1px solid rgba(234,179,8,0.25);border-radius:10px;margin-bottom:8px">
        <span style="color:#EAB308;font-size:16px">⚠️</span>
        <a href="https://iaenergia.es${a.href}" style="color:#fff;font-size:13px;text-decoration:none;font-weight:500">${a.texto}</a>
      </div>`).join('')
    : `<p style="color:#6B7280;font-size:13px;margin:0 0 16px">Sin alertas pendientes esta semana. 🟢</p>`

  function kpi(label: string, valor: string) {
    return `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1F1F1F">
        <span style="color:#9CA3AF;font-size:13px">${label}</span>
        <span style="color:#fff;font-size:13px;font-weight:600">${valor}</span>
      </div>`
  }

  const fechaTitulo = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#141414;border:1px solid #1F1F1F;border-radius:12px;overflow:hidden">
    <div style="padding:24px 32px;border-bottom:1px solid #1F1F1F;display:flex;align-items:center;gap:10px">
      <div style="width:28px;height:28px;background:#00E676;border-radius:6px;display:flex;align-items:center;justify-content:center">
        <span style="font-size:14px;font-weight:900;color:#000">⚡</span>
      </div>
      <span style="font-size:18px;font-weight:700;color:#fff">IA<span style="color:#00E676">energía</span></span>
    </div>
    <div style="padding:32px">
      <h1 style="color:#fff;font-size:20px;margin:0 0 4px">Cuadro de mando — ${fechaTitulo}</h1>
      <p style="color:#6B7280;font-size:12px;margin:0 0 20px">Resumen semanal automático</p>

      <h2 style="color:#fff;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 10px">Necesita tu atención</h2>
      ${alertasHtml}

      <h2 style="color:#fff;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;margin:24px 0 10px">Radar de negocio</h2>
      ${kpi('Leads sin procesar', `${leadsNuevos ?? 0}`)}
      ${kpi('Facturas comparadas (7 días)', `${facturas7d}`)}
      ${kpi('Ahorro detectado (7 días)', `${ahorro7d.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`)}
      ${kpi('Comisión anual proyectada (cartera)', `${comisionAnual.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`)}
      <p style="color:#6B7280;font-size:11px;margin:6px 0 0">
        Calculada solo con ${contratosConDatos} de ${filasCartera.length} contratos activos (el resto no tiene fee/kWh de comisión rellenos todavía) — no es el total real de la cartera.
      </p>
    </div>
  </div>
</body>
</html>`

  const resend = new Resend(process.env.RESEND_API_KEY!)
  await resend.emails.send({
    from: 'IAenergía <no-reply@iaenergia.es>',
    to: 'jonahrds@gmail.com',
    subject: `📊 Cuadro de mando — ${fechaTitulo}`,
    html,
  })

  return NextResponse.json({
    enviado: true,
    alertas: alertas.length,
    renovacionesProximas, gestionesVencidas, cuotasSinVerificar, contactosSinLeer,
    leadsNuevos, facturas7d, ahorro7d, comisionAnual,
    contratosConDatos, contratosActivosTotal: filasCartera.length,
  })
}
