import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Alta pública en el boletín semanal. Guarda el email y envía un correo de
// bienvenida con el enlace de baja (RGPD). Si el correo falla, el alta se
// mantiene — el envío semanal ya le llegará.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    const normalizado = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!EMAIL_RE.test(normalizado)) {
      return NextResponse.json({ error: 'Introduce un email válido' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: existente, error: selError } = await supabase
      .from('boletin_suscriptores')
      .select('id, activo, token')
      .eq('email', normalizado)
      .maybeSingle()
    if (selError) throw selError

    let token: string
    if (existente) {
      token = existente.token
      if (existente.activo) {
        return NextResponse.json({ ok: true, yaSuscrito: true })
      }
      const { error } = await supabase
        .from('boletin_suscriptores')
        .update({ activo: true, fecha_baja: null })
        .eq('id', existente.id)
      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from('boletin_suscriptores')
        .insert({ email: normalizado })
        .select('token')
        .single()
      if (error) throw error
      token = data.token
    }

    // Correo de bienvenida — mejor esfuerzo
    try {
      const resend = new Resend(process.env.RESEND_API_KEY!)
      const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.iaenergia.es'
      await resend.emails.send({
        from: 'IAenergía <no-reply@iaenergia.es>',
        to: normalizado,
        subject: 'Suscripción confirmada — Boletín semanal de IAenergía',
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
            <h2 style="color:#00A85A">Suscripción confirmada</h2>
            <p>A partir de ahora recibirás cada lunes el boletín semanal del mercado eléctrico de
            <strong>IAenergía</strong>: precio del mercado mayorista, demanda y mix de generación,
            con datos públicos de Red Eléctrica y redacción propia.</p>
            <p><a href="${base}/noticias/boletin" style="color:#00A85A">Ver el último boletín →</a></p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="font-size:12px;color:#888">Recibes este correo porque te has suscrito en iaenergia.es.
            Puedes <a href="${base}/api/boletin/baja?token=${token}" style="color:#888">darte de baja</a> cuando quieras.</p>
          </div>`,
      })
    } catch (e) {
      console.error('[suscribir] correo de bienvenida falló:', e)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[suscribir]', e)
    return NextResponse.json({ error: 'No se pudo completar la suscripción' }, { status: 500 })
  }
}
