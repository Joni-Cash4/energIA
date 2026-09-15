import { getSupabaseServerClient } from '@/lib/supabase-server'
import {
  SC_ESTIMADO_MENSUAL, SC_FALLBACK, CAP_REAL_MENSUAL, CAP_2026,
  PERD_DEFECTO, PERD_REAL_MENSUAL, type Tarifa, type Periodo,
} from '@/lib/market-rates'

// Valores reales de mercado (ESIOS PVPCDATA) guardados en Supabase por los crons
// mercado-perd-sync (mensual) y mercado-sc-cap-perd-diario (diario). Los cálculos solo
// leen estas tablas; nunca llaman a ESIOS en el momento de calcular.
//
// Orden de prioridad: Supabase (real) > tabla copiada en market-rates.ts (también
// real) > media real de 12 meses (market-rates.ts) si falta el mes.

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

  // Tier 2: PERD real mensual hardcodeado (extraído de facturas reales o informes Python)
  // Prioridad: PERD_DEFECTO → PERD_REAL_MENSUAL → Supabase (mayor autoridad)
  const perdMensual = PERD_REAL_MENSUAL[mes]?.[tarifa]
  if (perdMensual) {
    for (const [p, v] of Object.entries(perdMensual)) {
      perd[p as Periodo] = v as number
    }
    fuente = 'hardcoded'
  }

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

// SC, CAP y PERD con los días EXACTOS de la factura: media de mercado_sc_cap_perd_diario
// entre desde y hasta (fechas 'YYYY-MM-DD', ambas incluidas). Antes se usaba el mes de
// fecha_inicio para toda la factura, aunque abarcase dos meses o fuese del mes en curso.
// Los días que no estén en la tabla diaria se completan con getMercadoReal del mes de
// cada día. Cada día pesa lo mismo. La fuente es la peor de las usadas: 'supabase'
// solo si todos los días son dato real de Supabase.
export async function getMercadoRealRango(desde: string, hasta: string, tarifa: Tarifa): Promise<MercadoReal> {
  const dias: string[] = []
  for (let d = new Date(`${desde}T12:00:00Z`); d <= new Date(`${hasta}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    dias.push(d.toISOString().slice(0, 10))
  }
  if (dias.length === 0) return getMercadoReal(desde.slice(0, 7), tarifa)

  const diario = new Map<string, { sc: number; cap: number; perd: number }>()
  const supabase = getSupabaseServerClient()
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('mercado_sc_cap_perd_diario')
        .select('fecha, sc, cap, perd')
        .gte('fecha', desde)
        .lte('fecha', hasta)
      if (!error) {
        for (const r of data ?? []) diario.set(r.fecha, { sc: Number(r.sc), cap: Number(r.cap), perd: Number(r.perd) })
      }
    } catch (err) {
      console.error('[market-real] tabla diaria no disponible, se usa la mensual', err)
    }
  }

  const mesesQueFaltan = [...new Set(dias.filter((d) => !diario.has(d)).map((d) => d.slice(0, 7)))]
  const mensual = new Map(await Promise.all(mesesQueFaltan.map(async (m) => [m, await getMercadoReal(m, tarifa)] as const)))

  const periodos = Object.keys(PERD_DEFECTO[tarifa]) as Periodo[]
  const gravedad: Record<MercadoReal['fuente'], number> = { supabase: 0, hardcoded: 1, fallback: 2 }
  let sc = 0, cap = 0
  const perdSuma: Partial<Record<Periodo, number>> = {}
  let fuente: MercadoReal['fuente'] = 'supabase'
  for (const d of dias) {
    const dia = diario.get(d)
    const mes = dia ? null : mensual.get(d.slice(0, 7))!
    sc += dia ? dia.sc : mes!.sc
    cap += dia ? dia.cap : mes!.cap
    for (const p of periodos) {
      perdSuma[p] = (perdSuma[p] ?? 0) + (dia ? dia.perd : (mes!.perd[p] ?? PERD_DEFECTO[tarifa][p] ?? 0))
    }
    if (mes && gravedad[mes.fuente] > gravedad[fuente]) fuente = mes.fuente
  }

  const n = dias.length
  const perd: Partial<Record<Periodo, number>> = {}
  for (const p of periodos) perd[p] = (perdSuma[p] ?? 0) / n
  return { sc: sc / n, cap: cap / n, perd, fuente }
}
