import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

type Hito = 'mes4' | 'mes7' | 'mes11'

function diasDesdeInicio(fecha: string): number {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000)
}

function añosConNosotros(fechaInicio: string, numContratos: number): string {
  const años = Math.floor(diasDesdeInicio(fechaInicio) / 365)
  if (numContratos <= 1 || años < 1) return ''
  return años === 1 ? 'Ya llevamos **1 año** trabajando juntos' : `Ya llevamos **${años} años** trabajando juntos`
}

function buildEmailCliente(params: {
  nombre: string
  comercializadora_anterior: string
  numContratos: number
  fechaInicioContrato: string
  hito: Hito
  ahorroAcumulado: number | null
  ahorroNegativo: boolean
  kwhTotal: number | null
  esRenovacion: boolean
  mismaTarifaYCompania: boolean
}): { asunto: string; cuerpo: string } {
  const { nombre, comercializadora_anterior, numContratos, fechaInicioContrato, hito,
    ahorroAcumulado, ahorroNegativo, kwhTotal, esRenovacion, mismaTarifaYCompania } = params

  const añosTxt = añosConNosotros(fechaInicioContrato, numContratos)

  const introduccion = (() => {
    if (!esRenovacion) {
      return hito === 'mes4'
        ? 'Han pasado 3 meses desde que empezamos a gestionar tu energía y quería compartirte cómo van las cosas.'
        : 'Han pasado 6 meses desde que empezamos a gestionar tu energía. Aquí va el balance del semestre.'
    }
    if (mismaTarifaYCompania) {
      return hito === 'mes4'
        ? `${añosTxt} y quería hacerte un seguimiento tras estos primeros 3 meses desde que renovamos tus condiciones.`
        : `${añosTxt}. Aquí va el balance de los primeros 6 meses desde que renovamos tus condiciones.`
    }
    return hito === 'mes4'
      ? `${añosTxt} y quería hacerte un seguimiento de cómo va la nueva tarifa tras estos primeros 3 meses.`
      : `${añosTxt}. Aquí va el balance de los primeros 6 meses con tu nueva tarifa.`
  })()

  const periodoTxt = hito === 'mes4' ? 'trimestre' : 'semestre'

  const bloqueAhorro = (() => {
    if (ahorroAcumulado === null) return ''
    if (ahorroNegativo) {
      return `- El mercado en este ${periodoTxt} estuvo algo alto — la diferencia vs ${comercializadora_anterior || 'tu antigua tarifa'} ha sido de **${Math.abs(ahorroAcumulado).toFixed(0)}€** a su favor. Es algo puntual; a lo largo del año el mercado se equilibra.`
    }
    return `- Ahorro estimado vs ${comercializadora_anterior || 'tu antigua tarifa'}: **${ahorroAcumulado.toFixed(0)}€**`
  })()

  const bloqueKwh = kwhTotal !== null
    ? `- Consumo total del ${periodoTxt}: **${Math.round(kwhTotal).toLocaleString('es-ES')} kWh**`
    : ''

  const resumen = [bloqueAhorro, bloqueKwh].filter(Boolean).join('\n')

  const asunto = (() => {
    if (!esRenovacion) return `Tu balance ${hito === 'mes4' ? 'trimestral' : 'semestral'} con IAenergía — ${nombre}`
    if (mismaTarifaYCompania) return `${hito === 'mes4' ? '3' : '6'} meses desde tu renovación — ${nombre}`
    return `${hito === 'mes4' ? '3' : '6'} meses con tu nueva tarifa — ${nombre}`
  })()

  const cuerpo = `Hola ${nombre},

${introduccion}

**Resumen del ${periodoTxt}:**
${resumen || '- Datos en proceso de consolidación'}

Todo en orden por nuestra parte. Cualquier cosa que necesites, no dudes en escribirme.

Saludos,
Jonathan`

  return { asunto, cuerpo }
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

  // Clientes con contrato activo y fecha de inicio
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, empresa, email, comercializadora, fecha_inicio_contrato')
    .eq('estado', 'firmado')
    .not('fecha_inicio_contrato', 'is', null)
    .not('email', 'is', null)

  if (!clientes?.length) return NextResponse.json({ enviados: 0 })

  // Mensajes ya enviados
  const clienteIds = clientes.map(c => c.id)
  const { data: yaEnviados } = await supabase
    .from('mensajes_cliente')
    .select('cliente_id, tipo')
    .in('cliente_id', clienteIds)

  const enviados = new Set((yaEnviados ?? []).map(m => `${m.cliente_id}:${m.tipo}`))

  const hitos: { hito: Hito; diasMin: number; diasMax: number; facturasMeses: number }[] = [
    { hito: 'mes4',  diasMin: 118, diasMax: 125, facturasMeses: 3 },
    { hito: 'mes7',  diasMin: 208, diasMax: 215, facturasMeses: 6 },
    { hito: 'mes11', diasMin: 328, diasMax: 335, facturasMeses: 0 },
  ]

  const pendientes: Array<{
    cliente: typeof clientes[0]
    hito: Hito
    ahorroAcumulado: number | null
    ahorroNegativo: boolean
    kwhTotal: number | null
    esRenovacion: boolean
    mismaTarifaYCompania: boolean
    numContratos: number
    asunto: string
    cuerpo: string
  }> = []

  for (const cliente of clientes) {
    const dias = diasDesdeInicio(cliente.fecha_inicio_contrato)

    for (const { hito, diasMin, diasMax, facturasMeses } of hitos) {
      if (dias < diasMin || dias > diasMax) continue
      if (enviados.has(`${cliente.id}:${hito}`)) continue

      // Contratos históricos para saber si es renovación
      const { data: contratos } = await supabase
        .from('contratos')
        .select('id, comercializadora, tarifa, fecha_alta')
        .eq('cliente_id', cliente.id)
        .order('fecha_alta', { ascending: true })

      const numContratos = contratos?.length ?? 1
      const esRenovacion = numContratos > 1
      const primerContrato = contratos?.[0]
      const contratoActual = contratos?.[contratos.length - 1]
      const mismaTarifaYCompania = esRenovacion &&
        primerContrato?.comercializadora === contratoActual?.comercializadora &&
        primerContrato?.tarifa === contratoActual?.tarifa

      // Facturas reales del periodo
      let ahorroAcumulado: number | null = null
      let ahorroNegativo = false
      let kwhTotal: number | null = null

      if (facturasMeses > 0) {
        const { data: facturas } = await supabase
          .from('facturas_contrato')
          .select('kwh_total, ahorro_vs_anterior, periodo_fin')
          .eq('cliente_id', cliente.id)
          .not('periodo_fin', 'is', null)
          .order('periodo_fin', { ascending: false })
          .limit(facturasMeses)

        if (!facturas || facturas.length < facturasMeses) continue // no hay suficientes facturas

        const ahorro = facturas.reduce((s, f) => s + (f.ahorro_vs_anterior ?? 0), 0)
        ahorroAcumulado = Math.abs(ahorro)
        ahorroNegativo = ahorro < 0
        kwhTotal = facturas.reduce((s, f) => s + (f.kwh_total ?? 0), 0)
      }

      const { asunto, cuerpo } = buildEmailCliente({
        nombre: cliente.nombre || cliente.empresa || 'cliente',
        comercializadora_anterior: primerContrato?.comercializadora ?? '',
        numContratos,
        fechaInicioContrato: cliente.fecha_inicio_contrato,
        hito,
        ahorroAcumulado,
        ahorroNegativo,
        kwhTotal,
        esRenovacion,
        mismaTarifaYCompania,
      })

      pendientes.push({ cliente, hito, ahorroAcumulado, ahorroNegativo, kwhTotal, esRenovacion, mismaTarifaYCompania, numContratos, asunto, cuerpo })
    }
  }

  if (pendientes.length === 0) {
    return NextResponse.json({ enviados: 0, message: 'Sin hitos pendientes hoy' })
  }

  // Construir email resumen para Jonathan con todos los drafts del día
  const bloques = pendientes.map(p => {
    const hitoLabel = p.hito === 'mes4' ? '3 meses' : p.hito === 'mes7' ? '6 meses' : '11 meses (renovación)'
    return `
      <div style="margin-bottom:32px;padding:20px;background:#0F0F0F;border:1px solid #2A2A2A;border-radius:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div>
            <span style="color:#fff;font-weight:600">${p.cliente.empresa || p.cliente.nombre}</span>
            <span style="color:#6B7280;font-size:12px;margin-left:8px">${p.cliente.email}</span>
          </div>
          <span style="background:#00E676;color:#000;font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px">${hitoLabel}</span>
        </div>
        <div style="color:#9CA3AF;font-size:12px;margin-bottom:12px">
          <strong style="color:#6B7280">Asunto:</strong> ${p.asunto}
        </div>
        <div style="background:#141414;border-left:3px solid #00E676;padding:14px;border-radius:0 6px 6px 0;white-space:pre-line;font-size:13px;color:#E5E7EB;line-height:1.6">
${p.cuerpo}
        </div>
        <div style="margin-top:10px;text-align:right">
          <a href="mailto:${p.cliente.email}?subject=${encodeURIComponent(p.asunto)}&body=${encodeURIComponent(p.cuerpo)}"
             style="background:#1565C0;color:#fff;font-size:12px;font-weight:600;padding:6px 14px;border-radius:6px;text-decoration:none">
            Abrir en email →
          </a>
        </div>
      </div>`
  }).join('')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:Arial,sans-serif">
  <div style="max-width:640px;margin:40px auto;background:#141414;border:1px solid #1F1F1F;border-radius:12px;overflow:hidden">
    <div style="padding:24px 32px;border-bottom:1px solid #1F1F1F">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:28px;height:28px;background:#00E676;border-radius:6px;display:flex;align-items:center;justify-content:center">
          <span style="font-size:14px;font-weight:900;color:#000">⚡</span>
        </div>
        <span style="font-size:18px;font-weight:700;color:#fff">IA<span style="color:#00E676">energía</span></span>
      </div>
    </div>
    <div style="padding:32px">
      <h1 style="color:#fff;font-size:20px;margin:0 0 8px">
        ✉️ ${pendientes.length} email${pendientes.length !== 1 ? 's' : ''} de seguimiento pendiente${pendientes.length !== 1 ? 's' : ''}
      </h1>
      <p style="color:#6B7280;font-size:14px;margin:0 0 28px">
        Copia, personaliza y envía desde tu email. El botón abre tu cliente de correo con todo listo.
      </p>
      ${bloques}
    </div>
  </div>
</body>
</html>`

  const resend = new Resend(process.env.RESEND_API_KEY!)
  await resend.emails.send({
    from: 'IAenergía <no-reply@iaenergia.es>',
    to: 'jonahrds@gmail.com',
    subject: `✉️ ${pendientes.length} seguimiento${pendientes.length !== 1 ? 's' : ''} de cliente — IAenergía`,
    html,
  })

  // Registrar mensajes enviados
  await supabase.from('mensajes_cliente').insert(
    pendientes.map(p => ({ cliente_id: p.cliente.id, tipo: p.hito }))
  )

  return NextResponse.json({ enviados: pendientes.length })
}
