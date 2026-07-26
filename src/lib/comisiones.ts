import type { Contrato, EmpresaPago } from '@/types'

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

/**
 * Importe base de comisión de un contrato (ADR-0003): energía + potencia,
 * aplicando el reparto. La potencia es opcional — normalmente no se pacta,
 * pero la opción existe (ej. fee_potencia_mwh=1 además de energía=20 suma
 * ambos al total). Única fórmula, reutilizada en /dashboard/comisiones
 * (reclamable), /dashboard/contratos (importe al renovar) y
 * /dashboard/cartera (proyección de cartera) — no se duplica en cada sitio.
 * null si el contrato no tiene datos suficientes para calcularla.
 */
export function calcularComisionContrato(c: Pick<Contrato,
  'kwh_base_comision' | 'fee_energia_mwh' | 'kw_base_comision' | 'fee_potencia_mwh' | 'reparto_energia'
>): number | null {
  if (c.kwh_base_comision == null || c.fee_energia_mwh == null) return null
  const reparto = c.reparto_energia ?? 1
  const energia = c.kwh_base_comision * c.fee_energia_mwh / 1000
  const potencia = c.kw_base_comision != null && c.fee_potencia_mwh != null
    ? c.kw_base_comision * c.fee_potencia_mwh
    : 0
  return Math.round((energia + potencia) * reparto * 100) / 100
}
