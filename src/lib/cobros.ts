import type { ComisionGenerada } from '@/types'

// Regla de fraccionamiento de Próxima (confirmada ago-2026): una comisión
// > 10.000 € se cobra en 6 pagos, > 1.000 € en 3, y por debajo en pago único.
// Solo aplica a comisiones de Próxima; el resto de comercializadoras se tratan
// como pago único (no consta que fraccionen).
export function esComisionProxima(comercializadora: string | null | undefined): boolean {
  return (comercializadora ?? '').toLowerCase().includes('proxima')
}

export function numPagos(importe: number, esProxima: boolean): number {
  if (!esProxima) return 1
  if (importe > 10000) return 6
  if (importe > 1000) return 3
  return 1
}

// Último día de un mes (índice 0-based, admite desbordamiento de año) como
// cadena YYYY-MM-DD en hora local — evita el desfase de toISOString() (UTC).
function ultimoDiaMes(year: number, month0: number): string {
  const d = new Date(year, month0 + 1, 0)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface CobroPlan {
  num_pago: number
  total_pagos: number
  importe: number
  fecha_prevista: string
}

// Calendario de cobros de una comisión: N pagos iguales (el 1º absorbe el
// redondeo al céntimo), uno por mes consecutivo, con vencimiento el último día
// del mes, empezando en el mes de la fecha de la comisión.
export function generarCobros(
  comision: Pick<ComisionGenerada, 'importe' | 'fecha' | 'comercializadora'>
): CobroPlan[] {
  const n = numPagos(comision.importe, esComisionProxima(comision.comercializadora))
  const totalCent = Math.round(comision.importe * 100)
  const base = Math.floor(totalCent / n)
  const resto = totalCent - base * n // céntimos sobrantes → al primer pago
  const [y, m] = comision.fecha.split('-').map(Number)
  const plan: CobroPlan[] = []
  for (let i = 0; i < n; i++) {
    const cent = base + (i === 0 ? resto : 0)
    plan.push({
      num_pago: i + 1,
      total_pagos: n,
      importe: cent / 100,
      fecha_prevista: ultimoDiaMes(y, (m - 1) + i),
    })
  }
  return plan
}
