import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const PLATAFORMAS: Record<string, string> = {
  'TotalEnergies': 'https://agentes.totalenergies.es/#/facturas',
  'Próxima':       'https://clientes.proximaenergia.com/comercial-contratos',
  'Atulado':       'https://clientes.atuladoenergia.com/comercial-contratos',
  'Gana Energía':  'https://colaboradores.ganaenergia.com/',
  'Nordy Energía': 'https://colaboradores.nordyenergia.es/dashboardv4',
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Clientes con contrato activo y comercializadora conocida
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, empresa, comercializadora, cups, fecha_inicio_contrato')
    .not('fecha_inicio_contrato', 'is', null)
    .not('comercializadora', 'is', null)
    .in('estado', ['firmado'])

  if (!clientes?.length) {
    return NextResponse.json({ message: 'Sin clientes activos' })
  }

  // Agrupar por plataforma
  const porPlataforma = new Map<string, typeof clientes>()
  for (const c of clientes) {
    if (!PLATAFORMAS[c.comercializadora]) continue
    const arr = porPlataforma.get(c.comercializadora) ?? []
    arr.push(c)
    porPlataforma.set(c.comercializadora, arr)
  }

  if (porPlataforma.size === 0) {
    return NextResponse.json({ message: 'Sin clientes en plataformas conocidas' })
  }

  const mesAnterior = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toLocaleString('es-ES', { month: 'long', year: 'numeric' })
  })()

  const totalClientes = [...porPlataforma.values()].reduce((s, a) => s + a.length, 0)
  const plataformasActivas = [...porPlataforma.keys()]

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
      <h1 style="color:#fff;font-size:20px;margin:0 0 12px">📄 Facturas de ${mesAnterior}</h1>
      <p style="color:#9CA3AF;font-size:14px;margin:0 0 24px;line-height:1.6">
        Tienes <strong style="color:#fff">${totalClientes} clientes</strong> en
        <strong style="color:#fff">${plataformasActivas.join(', ')}</strong>.
        Abre Claude Code y escribe:
      </p>
      <div style="background:#0F0F0F;border:1px solid #2A2A2A;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center">
        <code style="color:#00E676;font-size:16px;font-weight:700;letter-spacing:0.03em">recoge facturas</code>
      </div>
      <p style="color:#374151;font-size:12px;margin:0">
        Me encargo de entrar en cada plataforma, descargar los PDFs y procesarlos en el CRM.
      </p>
    </div>
  </div>
</body>
</html>`

  const resend = new Resend(process.env.RESEND_API_KEY!)
  await resend.emails.send({
    from: 'IAenergía <no-reply@iaenergia.es>',
    to: 'jonahrds@gmail.com',
    subject: `📄 Facturas ${mesAnterior} — abre Claude Code`,
    html,
  })

  return NextResponse.json({ enviado: true, clientes: totalClientes })
}
