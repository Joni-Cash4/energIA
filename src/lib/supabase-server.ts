import { createClient } from '@supabase/supabase-js'

// Cliente Supabase para uso SOLO en server (API routes). Usa la service role key,
// que nunca debe exponerse al navegador — por eso no lleva prefijo NEXT_PUBLIC_.
// Se usa para leer los valores reales de mercado (SC/CAP/PERD) que el sistema
// Python local de Jonathan sincroniza mensualmente — Vercel nunca llama a ESIOS.
export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Soporta ambos nombres: SUPABASE_SERVICE_ROLE_KEY (nomenclatura clásica) y
  // SUPABASE_SECRET_KEY (nomenclatura nueva de Supabase) — ya configurada en .env.local
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}
