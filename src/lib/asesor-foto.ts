import { getSupabaseServerClient } from './supabase-server'

export const ASESOR_FOTO_BUCKET = 'asesor-foto'
export const ASESOR_FOTO_FILENAME = 'jonathan.jpg'
export const ASESOR_FOTO_FALLBACK = '/asesor/jonathan.jpeg'

// Foto del asesor: vive en Supabase Storage (editable desde /dashboard/asesor-foto sin
// redeploy). Si nunca se ha subido nada por esa vía, cae al archivo estático del repo.
export async function getAsesorFotoUrl(): Promise<string> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return ASESOR_FOTO_FALLBACK

  const { data } = await supabase.storage.from(ASESOR_FOTO_BUCKET).list('', { search: ASESOR_FOTO_FILENAME })
  const file = data?.find((f) => f.name === ASESOR_FOTO_FILENAME)
  if (!file) return ASESOR_FOTO_FALLBACK

  const { data: { publicUrl } } = supabase.storage.from(ASESOR_FOTO_BUCKET).getPublicUrl(ASESOR_FOTO_FILENAME)
  const version = file.updated_at ?? file.created_at ?? String(Date.now())
  return `${publicUrl}?v=${encodeURIComponent(version)}`
}
