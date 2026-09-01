import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase server client no configurado' }, { status: 500 })
  }

  // Aritmética de calendario en local, sin pasar por Date/UTC: toISOString()
  // convierte a UTC y con husos horarios positivos (España) desplaza la fecha
  // un día hacia atrás, excluyendo justo las cuotas del último día del mes.
  const hoy = new Date()
  const anio = hoy.getFullYear()
  const mes = hoy.getMonth() // 0-indexado
  const inicioMes = `${anio}-${String(mes + 1).padStart(2, '0')}-01`
  const anioSiguiente = mes === 11 ? anio + 1 : anio
  const mesSiguiente = mes === 11 ? 0 : mes + 1
  const inicioMesSiguiente = `${anioSiguiente}-${String(mesSiguiente + 1).padStart(2, '0')}-01`

  const { data: cobrosRaw } = await supabase
    .from('comision_cobros')
    .select('id, comision_id, importe, fecha_prevista')
    .eq('cobrado', false)
    .eq('verificado_prefactura', false)
    .gte('fecha_prevista', inicioMes)
    .lt('fecha_prevista', inicioMesSiguiente)

  if (!cobrosRaw?.length) {
    return NextResponse.json({ enviado: false, motivo: 'Sin cuotas pendientes de verificar este mes' })
  }

  type ComRow = {
    id: string; empresa_pago_id?: string
    cliente?: { nombre?: string; empresa?: string } | null
  }
  const [{ data: comsRaw }, { data: empresasRaw }] = await Promise.all([
    supabase.from('comisiones_generadas').select('id, empresa_pago_id, cliente:clientes(nombre, empresa)'),
    supabase.from('empresas_pago').select('id, nombre').eq('activo', true),
  ])
  const comById = new Map((comsRaw as unknown as ComRow[] ?? []).map(c => [c.id, c]))
  const empresaById = new Map((empresasRaw ?? []).map(e => [e.id as string, e.nombre as string]))

  type CuotaAviso = { cliente: string; importe: number; fecha: string }
  const porEmpresa = new Map<string, { nombre: string; cuotas: CuotaAviso[] }>()
  for (const cb of cobrosRaw) {
    const com = comById.get(cb.comision_id)
    const empId = com?.empresa_pago_id
    if (!empId) continue
    const nombre = empresaById.get(empId) ?? 'Empresa desconocida'
    if (!porEmpresa.has(empId)) porEmpresa.set(empId, { nombre, cuotas: [] })
    porEmpresa.get(empId)!.cuotas.push({
      cliente: com?.cliente?.nombre ?? com?.cliente?.empresa ?? '—',
      importe: cb.importe,
      fecha: cb.fecha_prevista,
    })
  }

  if (porEmpresa.size === 0) {
    return NextResponse.json({ enviado: false, motivo: 'Cuotas pendientes sin empresa pagadora resuelta' })
  }

  const mesNombre = hoy.toLocaleString('es-ES', { month: 'long', year: 'numeric' })
  const totalCuotas = [...porEmpresa.values()].reduce((s, e) => s + e.cuotas.length, 0)

  const bloquesHtml = [...porEmpresa.values()].map(e => `
    <div style="margin-bottom:20px">
      <p style="color:#fff;font-size:14px;font-weight:700;margin:0 0 8px">${e.nombre}</p>
      ${e.cuotas.map(c => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1F1F1F">
          <span style="color:#9CA3AF;font-size:13px">${c.cliente} · ${c.fecha}</span>
          <span style="color:#E5E7EB;font-size:13px;font-weight:600">${c.importe.toFixed(2)} €</span>
        </div>`).join('')}
    </div>`).join('')

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
      <h1 style="color:#fff;font-size:20px;margin:0 0 12px">⚠️ Prefacturas sin verificar — ${mesNombre}</h1>
      <p style="color:#9CA3AF;font-size:14px;margin:0 0 24px;line-height:1.6">
        <strong style="color:#fff">${totalCuotas} cuota${totalCuotas === 1 ? '' : 's'}</strong> de este mes
        siguen sin cotejarse contra la prefactura real. Revisa el correo de la empresa pagadora y súbela en
        <a href="https://iaenergia.es/dashboard/cobros" style="color:#00E676">/dashboard/cobros</a>.
      </p>
      ${bloquesHtml}
    </div>
  </div>
</body>
</html>`

  const resend = new Resend(process.env.RESEND_API_KEY!)
  await resend.emails.send({
    from: 'IAenergía <no-reply@iaenergia.es>',
    to: 'jonahrds@gmail.com',
    subject: `⚠️ Prefacturas sin verificar — ${mesNombre}`,
    html,
  })

  return NextResponse.json({
    enviado: true,
    total: totalCuotas,
    empresas: [...porEmpresa.values()].map(e => e.nombre),
  })
}
