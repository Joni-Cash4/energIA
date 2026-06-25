import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Protección: Vercel llama con el header Authorization: Bearer <CRON_SECRET>
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const hoy = new Date()
  const en30 = new Date(); en30.setDate(hoy.getDate() + 30)

  // Contratos activos que vencen en ≤30 días y no están verificados
  const { data: contratos, error } = await supabase
    .from('contratos')
    .select('*, cliente:clientes(nombre, empresa)')
    .lte('fecha_vencimiento', en30.toISOString().split('T')[0])
    .gte('fecha_vencimiento', hoy.toISOString().split('T')[0])
    .eq('renovacion_verificada', false)
    .eq('estado', 'activo')
    .order('fecha_vencimiento')

  if (error) {
    console.error('renewal-alerts cron error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!contratos || contratos.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No hay contratos próximos a vencer' })
  }

  // Agrupar por user_id
  const porUsuario = new Map<string, typeof contratos>()
  for (const c of contratos) {
    const arr = porUsuario.get(c.user_id) ?? []
    arr.push(c)
    porUsuario.set(c.user_id, arr)
  }

  const resend = new Resend(process.env.RESEND_API_KEY!)
  let emailsEnviados = 0

  for (const [userId, items] of porUsuario) {
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId)
    if (userError || !user?.email) continue

    const diasRestantes = (fecha: string) =>
      Math.ceil((new Date(fecha).getTime() - hoy.getTime()) / 86400000)

    const filas = items.map((c) => {
      const dias = c.fecha_vencimiento ? diasRestantes(c.fecha_vencimiento) : '?'
      const nombre = (c.cliente as { nombre?: string })?.nombre ?? c.cups ?? '—'
      const color = typeof dias === 'number' && dias <= 7 ? '#EF4444' : '#F59E0B'
      return `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #2A2A2A;color:#fff;font-weight:500">${nombre}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #2A2A2A;color:#9CA3AF;font-family:monospace;font-size:12px">${c.cups?.slice(0, 14) ?? '—'}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #2A2A2A;color:#9CA3AF">${c.comercializadora ?? '—'}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #2A2A2A;color:#9CA3AF">${c.fecha_vencimiento ?? '—'}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #2A2A2A;font-weight:700;color:${color}">${dias}d</td>
        </tr>`
    }).join('')

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:Arial,sans-serif">
  <div style="max-width:640px;margin:40px auto;background:#141414;border:1px solid #1F1F1F;border-radius:12px;overflow:hidden">
    <div style="background:#141414;padding:24px 32px;border-bottom:1px solid #1F1F1F">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:28px;height:28px;background:#00E676;border-radius:6px;display:flex;align-items:center;justify-content:center">
          <span style="font-size:14px;font-weight:900;color:#000">⚡</span>
        </div>
        <span style="font-size:18px;font-weight:700;color:#fff">IA<span style="color:#00E676">energía</span></span>
      </div>
    </div>

    <div style="padding:32px">
      <h1 style="color:#fff;font-size:20px;margin:0 0 8px">
        ${items.length} contrato${items.length !== 1 ? 's' : ''} próximo${items.length !== 1 ? 's' : ''} a vencer
      </h1>
      <p style="color:#6B7280;font-size:14px;margin:0 0 24px">
        Los siguientes contratos vencen en los próximos 30 días y están pendientes de renovación.
      </p>

      <table style="width:100%;border-collapse:collapse;background:#0F0F0F;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#1A1A1A">
            <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:.05em">Cliente</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:.05em">CUPS</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:.05em">Comercializadora</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:.05em">Vencimiento</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:.05em">Quedan</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>

      <div style="margin-top:24px">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/contratos"
           style="display:inline-block;background:#00E676;color:#000;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px">
          Gestionar renovaciones →
        </a>
      </div>

      <p style="color:#374151;font-size:12px;margin-top:24px">
        Recibirás este email cada día hasta que marques las renovaciones como verificadas en el dashboard.
      </p>
    </div>
  </div>
</body>
</html>`

    await resend.emails.send({
      from: 'IAenergía <no-reply@iaenergia.es>',
      to: user.email,
      subject: `⚡ ${items.length} contrato${items.length !== 1 ? 's' : ''} por renovar — IAenergía`,
      html,
    })

    emailsEnviados++
  }

  return NextResponse.json({ sent: emailsEnviados, contratos: contratos.length })
}
