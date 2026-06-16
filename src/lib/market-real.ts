import { getSupabaseServerClient } from '@/lib/supabase-server'
import {
  SC_ESTIMADO_MENSUAL, SC_FALLBACK, CAP_REAL_MENSUAL, CAP_2026,
  PERD_DEFECTO, type Tarifa, type Periodo,
} from '@/lib/market-rates'

// Valores reales de mercado sincronizados mensualmente desde el sistema Python
// local de Jonathan (ESIOS) a Supabase — ver C:\MonitorizacionEnergetica\sistema\
// sync_supabase_mensual.py. Vercel NUNCA llama a ESIOS, solo lee estas tablas.
//
// Orden de prioridad: Supabase (real, sincronizado) > tabla hardcodeada confirmada
// en market-rates.ts > fallback regulatorio por defecto.

export type MercadoReal = {
  sc: number
  cap: number
  perd: Partial<Record<Periodo, number>>
  fuente: 'supabase' | 'hardcoded' | 'fallback'
}

export async function getMercadoReal(mes: string, tarifa: Tarifa): Promise<MercadoReal> {
  const supabase = getSupabaseServerClient()

  let sc = SC_ESTIMADO_MENSUAL[mes] ?? SC_FALLBACK
  let cap = CAP_REAL_MENSUAL[mes] ?? CAP_2026
  let perd: Partial<Record<Periodo, number>> = { ...PERD_DEFECTO[tarifa] }
  let fuente: MercadoReal['fuente'] = SC_ESTIMADO_MENSUAL[mes] ? 'hardcoded' : 'fallback'

  if (!supabase) return { sc, cap, perd, fuente }

  try {
    const [scCapRes, perdRes] = await Promise.all([
      supabase.from('mercado_sc_cap').select('sc, cap').eq('mes', mes).maybeSingle(),
      supabase.from('mercado_perd').select('periodo, perd').eq('mes', mes).eq('tarifa', tarifa),
    ])

    if (scCapRes.data) {
      sc = scCapRes.data.sc
      cap = scCapRes.data.cap
      fuente = 'supabase'
    }
    if (perdRes.data && perdRes.data.length > 0) {
      for (const row of perdRes.data) {
        perd[row.periodo as Periodo] = row.perd
      }
      fuente = 'supabase'
    }
  } catch (err) {
    console.error('[market-real] Supabase no disponible, usando fallback', err)
  }

  return { sc, cap, perd, fuente }
}
