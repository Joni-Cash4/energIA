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
  const mejorTotal = Math.min(
    data.sim_indexada?.total ?? Infinity,
    data.sim_fija_boe?.total ?? Infinity,
    data.sim_fija_web?.total ?? Infinity,
  )
  const ahorroMensual = data.total_factura - (mejorTotal === Infinity ? data.total_factura : mejorTotal)
  const ahorroAnual = data.ahorro_estimado_anual ?? ahorroMensual * 12

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0B0F0E;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #1a2420;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#F3F5F3;letter-spacing:-0.01em;">
              IA<span style="color:#22D3A0;">energía</span>
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="color:#9CA3AF;font-size:14px;margin:0 0 8px;">Hola, <strong style="color:#F3F5F3;">${nombre}</strong></p>
            <h1 style="color:#F3F5F3;font-size:22px;font-weight:700;margin:0 0 8px;line-height:1.3;">
              Tu análisis de factura está listo
            </h1>
            <p style="color:#9CA3AF;font-size:15px;margin:0 0 28px;line-height:1.6;">
              Hemos analizado tu factura y esto es lo que hemos encontrado:
            </p>

            <!-- Numbers -->
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
                  <p style="color:#22D3A0;font-size:26px;font-weight:700;margin:0;">${eur(mejorTotal === Infinity ? undefined : mejorTotal)}</p>
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

            <!-- CTA -->
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

        <!-- Footer -->
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

function buildAlertEmail(
  nombre: string, email: string, telefono: string | undefined,
  empresa: string | undefined, data: InvoiceAnalysis
): string {
  const mejorTotal = Math.min(
    data.sim_indexada?.total ?? Infinity,
    data.sim_fija_boe?.total ?? Infinity,
    data.sim_fija_web?.total ?? Infinity,
  )
  const ahorroAnual = data.ahorro_estimado_anual ?? 0
  const waLink = telefono
    ? `https://wa.me/34${telefono.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(nombre)}%2C%20soy%20Jonathan%20de%20IAenerg%C3%ADa`
    : null

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
            ${empresa ? `<p style="color:#6B7280;font-size:13px;margin:0 0 20px;">${empresa}</p>` : '<div style="margin-bottom:20px;"></div>'}

            <!-- Contacto -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
                  <span style="color:#6B7280;font-size:13px;">Email</span>
                  <span style="float:right;color:#111;font-size:13px;font-weight:600;">${email}</span>
                </td>
              </tr>
              ${telefono ? `<tr>
                <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
                  <span style="color:#6B7280;font-size:13px;">Teléfono</span>
                  <span style="float:right;color:#111;font-size:13px;font-weight:600;">${telefono}</span>
                </td>
              </tr>` : ''}
            </table>

            <!-- Análisis -->
            <p style="color:#6B7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 12px;">Datos del análisis</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">
                <span style="color:#6B7280;font-size:13px;">Tarifa</span>
                <span style="float:right;color:#111;font-size:13px;font-weight:600;">${data.tarifa}</span>
              </td></tr>
              <tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">
                <span style="color:#6B7280;font-size:13px;">Factura actual</span>
                <span style="float:right;color:#111;font-size:13px;font-weight:600;">${eur(data.total_factura)}</span>
              </td></tr>
              <tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">
                <span style="color:#6B7280;font-size:13px;">Mejor opción</span>
                <span style="float:right;color:#22a87a;font-size:13px;font-weight:600;">${eur(mejorTotal === Infinity ? undefined : mejorTotal)}</span>
              </td></tr>
              <tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">
                <span style="color:#6B7280;font-size:13px;">Ahorro anual estimado</span>
                <span style="float:right;color:#22a87a;font-size:14px;font-weight:700;">${eur(ahorroAnual)}</span>
              </td></tr>
              <tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">
                <span style="color:#6B7280;font-size:13px;">Consumo anual</span>
                <span style="float:right;color:#111;font-size:13px;font-weight:600;">${data.kwh_anuales_sips?.toLocaleString('es-ES') ?? '—'} kWh</span>
              </td></tr>
              ${data.cups ? `<tr><td style="padding:6px 0;">
                <span style="color:#6B7280;font-size:13px;">CUPS</span>
                <span style="float:right;color:#6B7280;font-size:12px;font-family:monospace;">${data.cups}</span>
              </td></tr>` : ''}
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
