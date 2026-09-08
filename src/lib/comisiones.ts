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

export type Descomision = {
  diasTotales: number
  diasConsumidos: number
  diasPendientes: number
  /** Lo que cuesta cada día de contrato sin cumplir. */
  importeDiario: number
  /** Prorrata por días de la comisión no devengada. */
  estimada: number
  /** Lo que la comercializadora cargó de verdad, si ya se conoce. */
  real: number | null
  /** `real` si está informada, si no la estimación. */
  efectiva: number
  /** real − estimada. Positivo = te están cobrando de más. */
  desviacion: number | null
}

/**
 * Descomisión por baja anticipada: la parte de comisión ya cobrada que
 * corresponde al tiempo de contrato que no se llega a cumplir, a prorrata por
 * días naturales (la regla que aplican Total/AE2000).
 *
 *   descomisión = a_cobrar × días_pendientes / días_totales
 *
 * Devuelve null cuando no procede o no se puede calcular: contrato sin baja,
 * sin comisión cobrada, sin fechas, o llegado a vencimiento — cumplir el plazo
 * no penaliza, y una baja por renovación en fecha tampoco.
 */
export function calcularDescomision(c: Pick<Contrato,
  'fecha_alta' | 'fecha_vencimiento' | 'fecha_baja' | 'a_cobrar' | 'descomision'
>): Descomision | null {
  if (!c.fecha_alta || !c.fecha_vencimiento || !c.fecha_baja) return null
  if (c.a_cobrar == null || c.a_cobrar <= 0) return null

  const DIA = 86_400_000
  const alta = Date.parse(c.fecha_alta)
  const venc = Date.parse(c.fecha_vencimiento)
  const baja = Date.parse(c.fecha_baja)
  if ([alta, venc, baja].some(Number.isNaN)) return null

  const diasTotales = Math.round((venc - alta) / DIA)
  if (diasTotales <= 0) return null

  // Baja en vencimiento o después: contrato cumplido, no hay nada que devolver.
  // Antes del alta no es una baja anticipada sino un dato mal metido.
  if (baja >= venc || baja < alta) return null

  const diasConsumidos = Math.round((baja - alta) / DIA)
  const diasPendientes = diasTotales - diasConsumidos
  const round2 = (n: number) => Math.round(n * 100) / 100

  const estimada = round2(c.a_cobrar * diasPendientes / diasTotales)
  const real = c.descomision ?? null

  return {
    diasTotales,
    diasConsumidos,
    diasPendientes,
    importeDiario: round2(c.a_cobrar / diasTotales),
    estimada,
    real,
    efectiva: real ?? estimada,
    desviacion: real == null ? null : round2(real - estimada),
  }
}
