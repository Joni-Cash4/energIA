import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import type { InvoiceAnalysis } from '@/types'

const JONATHAN_EMAIL = 'contacto@iaenergia.es'
const FROM_EMAIL = 'IAenergía <noreply@iaenergia.es>'

function eur(n?: number) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function buildClientEmail(nombre: string, data: InvoiceAnalysis): string {
  const mejorTotal = data.sim_indexada?.total ?? null
  const ahorroAnual = data.ahorro_estimado_anual ?? 0

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0B0F0E;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #1a2420;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#F3F5F3;letter-spacing:-0.01em;">
              IA<span style="color:#22D3A0;">energía</span>
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 40px;">
            <p style="color:#9CA3AF;font-size:14px;margin:0 0 8px;">Hola, <strong style="color:#F3F5F3;">${nombre}</strong></p>
            <h1 style="color:#F3F5F3;font-size:22px;font-weight:700;margin:0 0 8px;line-height:1.3;">
              Tu análisis de factura está listo
            </h1>
            <p style="color:#9CA3AF;font-size:15px;margin:0 0 28px;line-height:1.6;">
              Hemos analizado tu factura y esto es lo que hemos encontrado:
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td width="48%" style="background:#141414;border:1px solid #1F1F1F;border-radius:10px;padding:20px;text-align:center;">
                  <p style="color:#9CA3AF;font-size:12px;margin:0 0 6px;text-transform:uppercase;letter-spacing:.05em;">Tu factura actual</p>
                  <p style="color:#F3F5F3;font-size:26px;font-weight:700;margin:0;">${eur(data.total_factura)}</p>
                  <p style="color:#6B7280;font-size:11px;margin:4px 0 0;">${data.dias_facturados ?? 30} días · ${data.tarifa}</p>
                </td>
                <td width="4%"></td>
                <td width="48%" style="background:#0d2620;border:1px solid #22D3A0;border-radius:10px;padding:20px;text-align:center;">
                  <p style="color:#22D3A0;font-size:12px;margin:0 0 6px;text-transform:uppercase;letter-spacing:.05em;">Mejor opción</p>
                  <p style="color:#22D3A0;font-size:26px;font-weight:700;margin:0;">${eur(mejorTotal ?? undefined)}</p>
                  <p style="color:#6B7280;font-size:11px;margin:4px 0 0;">mismo periodo</p>
                </td>
              </tr>
            </table>

            ${ahorroAnual > 0 ? `
            <div style="background:#0d2620;border:1px solid #22D3A0;border-radius:10px;padding:20px;text-align:center;margin-bottom:28px;">
              <p style="color:#9CA3AF;font-size:13px;margin:0 0 4px;">Ahorro estimado anual</p>
              <p style="color:#22D3A0;font-size:32px;font-weight:700;margin:0;">${eur(ahorroAnual)}</p>
              <p style="color:#6B7280;font-size:12px;margin:6px 0 0;">Sin cambiar nada más que la comercializadora</p>
            </div>` : ''}

            <p style="color:#9CA3AF;font-size:14px;line-height:1.7;margin:0 0 28px;">
              Estos números son una estimación basada en tu consumo real y los precios de mercado actuales.
              Para confirmarte el ahorro exacto y acompañarte en el proceso de cambio,
              <strong style="color:#F3F5F3;">hablamos sin compromiso.</strong>
            </p>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#22D3A0;border-radius:8px;padding:14px 28px;">
                  <a href="https://wa.me/34689880596?text=Hola%2C%20acabo%20de%20recibir%20mi%20an%C3%A1lisis%20de%20factura%20y%20me%20gustar%C3%ADa%20saber%20m%C3%A1s"
                     style="color:#0B0F0E;font-size:15px;font-weight:700;text-decoration:none;">
                    Hablar con Jonathan →
                  </a>
                </td>
              </tr>
            </table>

            <p style="color:#6B7280;font-size:12px;line-height:1.6;margin:0;">
              Este análisis se ha generado automáticamente a partir de tu factura.
              Los precios de energía pueden variar. IAenergía no es comercializadora —
              somos asesores independientes.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 40px;border-top:1px solid #1a2420;">
            <p style="color:#4B5563;font-size:12px;margin:0;">
              IAenergía · <a href="https://www.iaenergia.es" style="color:#22D3A0;text-decoration:none;">www.iaenergia.es</a> ·
              <a href="mailto:contacto@iaenergia.es" style="color:#22D3A0;text-decoration:none;">contacto@iaenergia.es</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function row(label: string, value: string, highlight = false) {
  const color = highlight ? '#22a87a' : '#111'
  const weight = highlight ? '700' : '600'
  return `<tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">
    <span style="color:#6B7280;font-size:13px;">${label}</span>
    <span style="float:right;color:${color};font-size:13px;font-weight:${weight};">${value}</span>
  </td></tr>`
}

function buildAlertEmail(
  nombre: string, email: string, telefono: string | undefined,
  empresa: string | undefined, data: InvoiceAnalysis
): string {
  const ahorroAnual = data.ahorro_estimado_anual ?? 0
  const waLink = telefono
    ? `https://wa.me/34${telefono.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(nombre)}%2C%20soy%20Jonathan%20de%20IAenerg%C3%ADa`
    : null

  const si = data.sim_indexada
  const sb = data.sim_fija_boe
  const sw = data.sim_fija_web
  const rec = data.atulado_recomendado

  // Potencias extraídas
  const potencias = data.potencias ?? []
  const potStr = potencias.length > 0
    ? potencias.map(p => `${p.periodo}:${p.kw}kW`).join(' | ')
    : `${data.potencia_contratada ?? '—'} kW (uniforme)`

  const tipoIee = data.tipo_iee_detectado
  const tipoIva = data.tipo_iva_detectado

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

        <tr>
          <td style="background:#0B0F0E;padding:20px 32px;">
            <p style="margin:0;font-size:18px;font-weight:700;color:#F3F5F3;">
              IA<span style="color:#22D3A0;">energía</span> — Nuevo lead
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px;">
            <h2 style="color:#111;font-size:20px;margin:0 0 4px;">${nombre}</h2>
            ${empresa ? `<p style="color:#6B7280;font-size:13px;margin:0 0 16px;">${empresa}</p>` : '<div style="margin-bottom:16px;"></div>'}

            <!-- Contacto -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              ${row('Email', email)}
              ${telefono ? row('Teléfono', telefono) : ''}
            </table>

            <!-- Factura extraída -->
            <p style="color:#6B7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;">Datos extraídos de la factura</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              ${row('Tarifa', data.tarifa ?? '—')}
              ${row('Factura actual', eur(data.total_factura))}
              ${row('Días facturados', `${data.dias_facturados ?? '—'} días`)}
              ${row('kWh total periodo', `${data.kwh_total?.toLocaleString('es-ES') ?? '—'} kWh`)}
              ${row('Consumo anual (×12)', `${data.kwh_anuales_sips?.toLocaleString('es-ES') ?? '—'} kWh`)}
              ${row('Potencias por periodo', potStr)}
              ${tipoIee != null ? row('IEE detectado', `${(tipoIee * 100).toFixed(4)}%`) : ''}
              ${tipoIva != null ? row('IVA detectado', `${(tipoIva * 100).toFixed(2)}%`) : ''}
              ${data.cups ? row('CUPS', `<span style="font-family:monospace;font-size:12px;">${data.cups}</span>`) : ''}
            </table>

            <!-- Comparativa simulaciones -->
            <p style="color:#6B7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;">Comparativa simulada</p>
            <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:8px;border-collapse:collapse;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;border-bottom:1px solid #e5e7eb;"></th>
                  <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6B7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Indexada</th>
                  <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6B7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Fija BOE${rec === 'BOE' ? ' ★' : ''}</th>
                  <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6B7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Fija WEB${rec === 'WEB' ? ' ★' : ''}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding:7px 12px;font-size:13px;color:#6B7280;border-bottom:1px solid #f0f0f0;">Energía</td>
                  <td style="padding:7px 12px;font-size:13px;color:#111;text-align:right;border-bottom:1px solid #f0f0f0;">${eur(si?.energia)}</td>
                  <td style="padding:7px 12px;font-size:13px;color:#111;text-align:right;border-bottom:1px solid #f0f0f0;">${eur(sb?.energia)}</td>
                  <td style="padding:7px 12px;font-size:13px;color:#111;text-align:right;border-bottom:1px solid #f0f0f0;">${eur(sw?.energia)}</td>
                </tr>
                <tr>
                  <td style="padding:7px 12px;font-size:13px;color:#6B7280;border-bottom:1px solid #f0f0f0;">Potencia</td>
                  <td style="padding:7px 12px;font-size:13px;color:#111;text-align:right;border-bottom:1px solid #f0f0f0;">${eur(si?.potencia)}</td>
                  <td style="padding:7px 12px;font-size:13px;color:#111;text-align:right;border-bottom:1px solid #f0f0f0;">${eur(sb?.potencia)}</td>
                  <td style="padding:7px 12px;font-size:13px;color:#111;text-align:right;border-bottom:1px solid #f0f0f0;">${eur(sw?.potencia)}</td>
                </tr>
                ${si?.otros_costes ? `<tr>
                  <td style="padding:7px 12px;font-size:13px;color:#6B7280;border-bottom:1px solid #f0f0f0;">Otros costes</td>
                  <td style="padding:7px 12px;font-size:13px;color:#111;text-align:right;border-bottom:1px solid #f0f0f0;">${eur(si.otros_costes)}</td>
                  <td style="padding:7px 12px;font-size:13px;color:#111;text-align:right;border-bottom:1px solid #f0f0f0;">—</td>
                  <td style="padding:7px 12px;font-size:13px;color:#111;text-align:right;border-bottom:1px solid #f0f0f0;">—</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:7px 12px;font-size:13px;color:#6B7280;border-bottom:1px solid #f0f0f0;">IEE</td>
                  <td style="padding:7px 12px;font-size:13px;color:#111;text-align:right;border-bottom:1px solid #f0f0f0;">${eur(si?.iee)}</td>
                  <td style="padding:7px 12px;font-size:13px;color:#111;text-align:right;border-bottom:1px solid #f0f0f0;">${eur(sb?.iee)}</td>
                  <td style="padding:7px 12px;font-size:13px;color:#111;text-align:right;border-bottom:1px solid #f0f0f0;">${eur(sw?.iee)}</td>
                </tr>
                <tr>
                  <td style="padding:7px 12px;font-size:13px;color:#6B7280;border-bottom:1px solid #f0f0f0;">IVA</td>
                  <td style="padding:7px 12px;font-size:13px;color:#111;text-align:right;border-bottom:1px solid #f0f0f0;">${eur(si?.iva)}</td>
                  <td style="padding:7px 12px;font-size:13px;color:#111;text-align:right;border-bottom:1px solid #f0f0f0;">${eur(sb?.iva)}</td>
                  <td style="padding:7px 12px;font-size:13px;color:#111;text-align:right;border-bottom:1px solid #f0f0f0;">${eur(sw?.iva)}</td>
                </tr>
                <tr style="background:#f0faf5;">
                  <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#111;">TOTAL</td>
                  <td style="padding:8px 12px;font-size:14px;font-weight:700;color:#22a87a;text-align:right;">${eur(si?.total)}</td>
                  <td style="padding:8px 12px;font-size:14px;font-weight:700;color:#22a87a;text-align:right;">${eur(sb?.total)}</td>
                  <td style="padding:8px 12px;font-size:14px;font-weight:700;color:#22a87a;text-align:right;">${eur(sw?.total)}</td>
                </tr>
              </tbody>
            </table>

            <!-- Ahorro -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              ${row('Ahorro anual estimado (indexada)', eur(ahorroAnual), true)}
            </table>

            ${waLink ? `
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#25D366;border-radius:8px;padding:12px 24px;">
                  <a href="${waLink}" style="color:#fff;font-size:14px;font-weight:700;text-decoration:none;">
                    WhatsApp → ${nombre.split(' ')[0]}
                  </a>
                </td>
              </tr>
            </table>` : ''}
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nombre, email, telefono, empresa, invoice_data } = body as {
      nombre: string
      email: string
      telefono?: string
      empresa?: string
      invoice_data: InvoiceAnalysis
    }

    if (!nombre || !email) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    // 1. Guardar en Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const mensaje = [
      empresa ? `Empresa: ${empresa}` : null,
      `Tarifa: ${invoice_data?.tarifa ?? ''}`,
      `Factura: ${invoice_data?.total_factura ?? ''}€`,
      `Ahorro anual: ${invoice_data?.ahorro_estimado_anual ?? ''}€`,
    ].filter(Boolean).join(' | ')

    await supabase.from('contactos').insert({ nombre, email, telefono: telefono || null, mensaje })

    // También como lead en el pipeline del dashboard (antes solo iba a
    // "Mensajes web" y la pestaña Leads quedaba siempre vacía)
    const { error: leadError } = await supabase.from('leads').insert({
      nombre,
      email,
      telefono: telefono || null,
      empresa: empresa || null,
      cups: invoice_data?.cups || null,
      comercializadora: invoice_data?.comercializadora || null,
      tarifa: invoice_data?.tarifa || null,
      total_factura: invoice_data?.total_factura ?? null,
      kwh_total: invoice_data?.kwh_total ?? null,
      ahorro_estimado_anual: invoice_data?.ahorro_estimado_anual ?? null,
      kwh_anuales_sips: invoice_data?.kwh_anuales_sips ?? null,
      estado: 'nuevo',
    })
    if (leadError) console.error('[send-report] insert lead falló:', leadError)

    // 2. Enviar emails (si hay API key configurada)
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey && invoice_data) {
      const resend = new Resend(resendKey)

      await Promise.allSettled([
        // Email al cliente
        resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject: `Tu análisis de factura eléctrica — ${invoice_data.ahorro_estimado_anual > 0 ? `puedes ahorrar ${Math.round(invoice_data.ahorro_estimado_anual)}€/año` : 'IAenergía'}`,
          html: buildClientEmail(nombre, invoice_data),
        }),
        // Alerta a Jonathan
        resend.emails.send({
          from: FROM_EMAIL,
          to: JONATHAN_EMAIL,
          subject: `🔔 Nuevo lead: ${nombre}${invoice_data.ahorro_estimado_anual > 0 ? ` — ${Math.round(invoice_data.ahorro_estimado_anual)}€/año` : ''}`,
          html: buildAlertEmail(nombre, email, telefono, empresa, invoice_data),
        }),
      ])
    }

    return NextResponse.json({ success: true, message: 'Informe registrado correctamente' })
  } catch (e) {
    console.error('[send-report]', e)
    return NextResponse.json({ error: 'Error al registrar la solicitud' }, { status: 500 })
  }
}
