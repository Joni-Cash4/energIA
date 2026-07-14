import { getSupabaseServerClient } from '@/lib/supabase-server'
import type { Periodo, Tarifa } from '@/lib/market-rates'

// Productos de precio fijo sincronizados desde el maestro local de Jonathan
// (tarifas_maestro.xlsx → tabla tarifas_fijas, ver sistema Python
// modules/sync_tarifas_supabase.py). La web nunca lee el Excel — solo esta tabla.

export type ProductoFijo = {
  comercializadora: string
  producto: string
  etiqueta: string                          // "ATULADO — 2.0TD DH Empresas"
  energia: Partial<Record<Periodo, number>>  // €/kWh
  potencia: Partial<Record<Periodo, number>> // €/kW·DÍA (ya convertido desde €/kW·año)
  fecha_anexo: string | null
  dias_anexo: number | null
}

export async function getProductosFijos(tarifa: Tarifa): Promise<ProductoFijo[]> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('tarifas_fijas')
      .select('comercializadora, producto, tarifa_acceso, energia, potencia, fecha_anexo')
      .eq('activo', true)
      .eq('tarifa_acceso', tarifa)

    if (error || !data) return []

    const hoy = Date.now()
    return data.map((row) => {
      const potenciaDia: Partial<Record<Periodo, number>> = {}
      for (const [p, v] of Object.entries(row.potencia ?? {})) {
        potenciaDia[p as Periodo] = (v as number) / 365 // maestro guarda €/kW·año
      }
      return {
        comercializadora: row.comercializadora,
        producto: row.producto,
        etiqueta: `${row.comercializadora} — ${row.producto}`,
        energia: (row.energia ?? {}) as Partial<Record<Periodo, number>>,
        potencia: potenciaDia,
        fecha_anexo: row.fecha_anexo,
        dias_anexo: row.fecha_anexo
          ? Math.floor((hoy - new Date(row.fecha_anexo).getTime()) / 86400000)
          : null,
      }
    })
  } catch (err) {
    console.error('[tarifas-fijas] Supabase no disponible, se usa fallback hardcodeado', err)
    return []
  }
}
