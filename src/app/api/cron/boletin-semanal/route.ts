import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { buildBoletin, fmtEs, type BoletinData } from '@/lib/boletin'

// Envío del boletín semanal por email — lunes por la mañana (ver vercel.json).
// Misma protección CRON_SECRET que el resto de crons. Acepta ?test_email= para
// enviar SOLO a esa dirección (prueba manual sin tocar a los suscriptores).

export const maxDuration = 60

function varTxt(v: number | null): string {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}${fmtEs(v)}%`
}

function varColor(v: number | null, invertir = false): string {
  if (v == null) return '#888888'
  const positivo = invertir ? v >= 0 : v < 0
  return positivo ? '#00A85A' : '#D64545'
}

function kpi(label: string, valor: string, sub: string, subColor: string): string {
  return `<td style="padding:12px;border:1px solid #eeeeee;border-radius:8px;vertical-align:top">
    <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px">${label}</div>
    <div style="font-size:20px;font-weight:700;color:#1a1a1a;margin-top:4px">${valor}</div>
    <div style="font-size:12px;margin-top:4px;color:${subColor}">${sub}</div>
  </td>`
}

function emailHtml(b: BoletinData, base: string, token: string): string {
  const filas = b.generacion.tecnologias.map((t) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333">${t.nombre}${t.renovable ? ' <span style="color:#00A85A;font-size:10px">RENOVABLE</span>' : ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;text-align:right">${fmtEs(t.gwh, 0)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;text-align:right">${fmtEs(t.cuota)}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;color:${varColor(t.variacion, t.renovable)}">${varTxt(t.variacion)}</td>
    </tr>`).join('')

  const parrafos = [...b.textos.mercado, ...b.textos.balance]
    .map((p) => `<p style="font-size:14px;line-height:1.6;color:#444;margin:0 0 12px">${p}</p>`).join('')

  return `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;padding:8px">
    <div style="padding:20px 0;border-bottom:2px solid #00A85A">
      <span style="font-size:20px;font-weight:700">⚡ IAenergía</span>
      <span style="float:right;font-size:12px;color:#888;padding-top:6px">Boletín semanal del mercado</span>
    </div>

    <h1 style="font-size:20px;margin:24px 0 4px">El mercado eléctrico, esta semana</h1>
    <p style="font-size:13px;color:#888;margin:0 0 20px">${b.semana.label}</p>

    <table role="presentation" width="100%" cellspacing="8" cellpadding="0" style="border-collapse:separate">
      <tr>
        ${kpi('Precio medio spot', `${fmtEs(b.precios.media, 2)} €/MWh`, `vs semana anterior ${varTxt(b.precios.variacionSemanal)}`, varColor(b.precios.variacionSemanal))}
        ${kpi('Vs año anterior', b.precios.mediaAnyoPasado ? `${fmtEs(b.precios.mediaAnyoPasado, 2)} €/MWh` : '—', varTxt(b.precios.variacionInteranual), varColor(b.precios.variacionInteranual))}
      </tr>
      <tr>
        ${kpi('Demanda peninsular', `${fmtEs(b.demanda.gwh, 0)} GWh`, varTxt(b.demanda.variacionInteranual), varColor(b.demanda.variacionInteranual))}
        ${kpi('Cuota renovable', `${fmtEs(b.generacion.cuotaRenovable)}%`, varTxt(b.generacion.variacionRenovables), varColor(b.generacion.variacionRenovables, true))}
      </tr>
    </table>

    <div style="margin:20px 0">${parrafos}</div>

    <h2 style="font-size:15px;margin:24px 0 8px">Generación por tecnología</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #eee;border-radius:8px;border-collapse:separate;overflow:hidden">
      <tr style="background:#fafafa">
        <th style="padding:8px 12px;font-size:11px;color:#888;text-align:left;text-transform:uppercase">Tecnología</th>
        <th style="padding:8px 12px;font-size:11px;color:#888;text-align:right;text-transform:uppercase">GWh</th>
        <th style="padding:8px 12px;font-size:11px;color:#888;text-align:right;text-transform:uppercase">Cuota</th>
        <th style="padding:8px 12px;font-size:11px;color:#888;text-align:right;text-transform:uppercase">Vs ${new Date(b.semana.inicio).getUTCFullYear() - 1}</th>
      </tr>
      <tr style="background:#F0FBF5">
        <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#00A85A">Renovables (total)</td>
        <td style="padding:8px 12px;font-size:13px;font-weight:700;text-align:right">${fmtEs(b.generacion.renovablesGwh, 0)}</td>
        <td style="padding:8px 12px;font-size:13px;font-weight:700;text-align:right">${fmtEs(b.generacion.cuotaRenovable)}%</td>
        <td style="padding:8px 12px;font-size:13px;font-weight:700;text-align:right;color:${varColor(b.generacion.variacionRenovables, true)}">${varTxt(b.generacion.variacionRenovables)}</td>
      </tr>
      ${filas}
    </table>

    <div style="text-align:center;margin:28px 0">
      <a href="${base}/noticias/boletin" style="background:#00A85A;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">Ver el boletín completo con gráficas</a>
    </div>

    <p style="text-align:center;margin:20px 0"><a href="${base}/comparador" style="color:#00A85A;font-size:13px">¿Pagas de más? Analiza tu factura gratis →</a></p>

    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="font-size:11px;color:#999;line-height:1.5">
      Fuente: ${b.fuente}.<br>
      Recibes este correo porque te suscribiste en iaenergia.es.
      <a href="${base}/api/boletin/baja?token=${token}" style="color:#999">Darse de baja</a>
    </p>
  </div>`
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let boletin: BoletinData
  try {
    boletin = await buildBoletin()
  } catch (e) {
    console.error('[boletin-semanal] sin datos REE, no se envía:', e)
    return NextResponse.json({ sent: 0, error: 'Datos de REE no disponibles' }, { status: 503 })
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.iaenergia.es'
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const asunto = `⚡ El mercado eléctrico, esta semana: ${fmtEs(boletin.precios.media, 2)} €/MWh (${varTxt(boletin.precios.variacionSemanal)})`

  // Modo prueba: enviar solo a la dirección indicada, sin tocar suscriptores
  const testEmail = req.nextUrl.searchParams.get('test_email')
  if (testEmail) {
    await resend.emails.send({
      from: 'IAenergía <no-reply@iaenergia.es>',
      to: testEmail,
      subject: `[PRUEBA] ${asunto}`,
      html: emailHtml(boletin, base, '00000000-0000-0000-0000-000000000000'),
    })
    return NextResponse.json({ sent: 1, test: true })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: subs, error } = await supabase
    .from('boletin_suscriptores')
    .select('email, token')
    .eq('activo', true)
  if (error) {
    console.error('[boletin-semanal]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!subs?.length) {
    return NextResponse.json({ sent: 0, message: 'Sin suscriptores activos' })
  }

  // Envío en lotes de 100 (límite del batch de Resend); cada uno con su token de baja
  let enviados = 0
  for (let i = 0; i < subs.length; i += 100) {
    const lote = subs.slice(i, i + 100).map((s) => ({
      from: 'IAenergía <no-reply@iaenergia.es>',
      to: s.email,
      subject: asunto,
      html: emailHtml(boletin, base, s.token),
    }))
    const { error: batchError } = await resend.batch.send(lote)
    if (batchError) console.error('[boletin-semanal] lote falló:', batchError)
    else enviados += lote.length
  }

  return NextResponse.json({ sent: enviados, semana: boletin.semana.label })
}
