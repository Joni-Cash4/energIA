import type { EmpresaPago } from '@/types'

/**
 * Resuelve qué empresa pagadora corresponde a una comercializadora de contrato,
 * usando las keywords configuradas en cada empresa_pago. Si ninguna matchea,
 * devuelve la marcada como es_default (Soillik: "el resto de compañías").
 */
export function resolverEmpresaPago(
  comercializadora: string | null | undefined,
  empresas: EmpresaPago[]
): EmpresaPago | null {
  const activas = empresas.filter(e => e.activo)
  if (activas.length === 0) return null

  const texto = (comercializadora ?? '').toLowerCase()
  if (texto) {
    const match = activas.find(e =>
      e.comercializadoras_keywords.some(k => texto.includes(k.toLowerCase()))
    )
    if (match) return match
  }

  return activas.find(e => e.es_default) ?? null
}
