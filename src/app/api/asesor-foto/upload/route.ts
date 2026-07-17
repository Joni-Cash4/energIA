import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

const BUCKET = 'asesor-foto'
const FILENAME = 'jonathan.jpg'

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()
    if (!supabase) throw new Error('Supabase server client no configurado')

    const form = await req.formData()
    const foto = form.get('foto') as File | null
    if (!foto) return NextResponse.json({ error: 'Falta campo: foto' }, { status: 400 })

    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {})

    const bytes = await foto.arrayBuffer()
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(FILENAME, bytes, { contentType: 'image/jpeg', upsert: true })
    if (uploadErr) throw new Error(`Storage: ${uploadErr.message}`)

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(FILENAME)
    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error('[asesor-foto/upload]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
