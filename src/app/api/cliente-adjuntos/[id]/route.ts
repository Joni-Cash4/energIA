import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

const BUCKET = 'ofertas-adjuntos'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = getSupabaseServerClient()
    if (!supabase) throw new Error('Supabase server client no configurado')

    const { data: adjunto, error: fetchErr } = await supabase
      .from('cliente_adjuntos')
      .select('storage_path')
      .eq('id', id)
      .single()
    if (fetchErr) throw new Error(`Fetch: ${fetchErr.message}`)

    if (adjunto?.storage_path) {
      const { error: removeErr } = await supabase.storage.from(BUCKET).remove([adjunto.storage_path])
      if (removeErr) console.error('[cliente-adjuntos/delete] storage remove error:', removeErr.message)
    }

    const { error: deleteErr } = await supabase.from('cliente_adjuntos').delete().eq('id', id)
    if (deleteErr) throw new Error(`Delete: ${deleteErr.message}`)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[cliente-adjuntos/delete]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
