import type { Contrato } from '@/types'

/**
 * Resuelve a qué contrato concreto de un cliente se refiere una gestión, a
 * partir de evidencias (CUPS y/o comercializadora mencionados) — nunca a
 * partir de una decisión directa de la IA. Solo enlaza cuando hay una única
 * coincidencia inequívoca; si hay ambigüedad o ningún dato, devuelve null
 * (mismo principio que la resolución de contrato en facturas-contrato/upload,
 * ADR-0001/ADR-0004).
 */
export function resolverContratoGestion(
  contratos: Pick<Contrato, 'id' | 'cups' | 'comercializadora'>[],
  evidencia: { cups?: string | null; comercializadora?: string | null },
): string | null {
  if (contratos.length === 0) return null
  if (contratos.length === 1) return contratos[0].id

  if (evidencia.cups) {
    const cupsNorm = evidencia.cups.trim().toUpperCase()
    const porCups = contratos.filter(c => c.cups?.trim().toUpperCase() === cupsNorm)
    if (porCups.length === 1) return porCups[0].id
  }

  if (evidencia.comercializadora) {
    const compNorm = evidencia.comercializadora.trim().toLowerCase()
    const porComp = contratos.filter(c => {
      const cc = c.comercializadora?.trim().toLowerCase()
      return !!cc && (cc.includes(compNorm) || compNorm.includes(cc))
    })
    if (porComp.length === 1) return porComp[0].id
  }

  return null
}
