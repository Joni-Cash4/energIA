import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

const BUCKET = 'ofertas-adjuntos'

function detectTipo(contentType: string): 'imagen' | 'pdf' | 'otro' {
  if (contentType.startsWith('image/')) return 'imagen'
  if (contentType === 'application/pdf') return 'pdf'
  return 'otro'
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()
    if (!supabase) throw new Error('Supabase server client no configurado')

    const form = await req.formData()
    const file = form.get('file') as File | null
    const clienteId = form.get('clienteId') as string | null
    const contratoId = form.get('contratoId') as string | null
    const nombre = form.get('nombre') as string | null

    if (!file) return NextResponse.json({ error: 'Falta campo: file' }, { status: 400 })
    if (!clienteId) return NextResponse.json({ error: 'Falta campo: clienteId' }, { status: 400 })

    const { data: { user } } = await supabase.auth.getUser()

    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {})

    const bytes = await file.arrayBuffer()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${clienteId}/${Date.now()}_${safeName}`

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (uploadErr) throw new Error(`Storage: ${uploadErr.message}`)

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

    // user_id es NOT NULL en cliente_adjuntos; sin sesión (ej. llamada de servicio) cae al owner del cliente.
    let userId = user?.id ?? null
    if (!userId) {
      const { data: cliente } = await supabase.from('clientes').select('user_id').eq('id', clienteId).single()
      userId = cliente?.user_id ?? null
    }
    if (!userId) throw new Error('No se pudo determinar el usuario propietario')

    const { data: adjunto, error: insertErr } = await supabase
      .from('cliente_adjuntos')
      .insert({
        user_id: userId,
        cliente_id: clienteId,
        contrato_id: contratoId || null,
        nombre: nombre || file.name,
        tipo: detectTipo(file.type || ''),
        url: publicUrl,
        storage_path: storagePath,
      })
      .select()
      .single()

    if (insertErr) throw new Error(`Insert: ${insertErr.message}`)

    return NextResponse.json({ adjunto })
  } catch (err) {
    console.error('[cliente-adjuntos/upload]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
