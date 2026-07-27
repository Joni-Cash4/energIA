import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nombre, email, telefono, mensaje } = body

    if (!nombre || !email || !mensaje) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase server client no configurado' }, { status: 500 })
    }

    const { error } = await supabase.from('contactos').insert({ nombre, email, telefono, mensaje })
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[contacto]', e)
    return NextResponse.json({ error: 'Error al guardar el mensaje' }, { status: 500 })
  }
}
