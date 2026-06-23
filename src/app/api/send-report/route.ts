import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nombre, email, telefono, empresa, invoice_data } = body

    if (!nombre || !email) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const mensaje = [
      empresa ? `Empresa: ${empresa}` : null,
      invoice_data ? `Tarifa: ${invoice_data.tarifa ?? ''}` : null,
      invoice_data ? `CUPS: ${invoice_data.cups ?? ''}` : null,
    ].filter(Boolean).join(' | ') || 'Solicitud desde comparador'

    const { error } = await supabase
      .from('contactos')
      .insert({ nombre, email, telefono: telefono || null, mensaje })

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Informe registrado correctamente' })
  } catch (e) {
    console.error('[send-report]', e)
    return NextResponse.json({ error: 'Error al registrar la solicitud' }, { status: 500 })
  }
}
