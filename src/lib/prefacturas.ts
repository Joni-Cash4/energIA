// Conciliación de prefacturas (comision_cobros): cruza las líneas extraídas
// de una prefactura (cualquier empresa pagadora — Geoatlanter, Gaolania,
// Escandinava, Soillik...) contra las cuotas pendientes de esa empresa, sin
// depender del formato concreto de ningún emisor. Funciones puras, sin
// efectos secundarios — mismo estilo que comisiones.ts.

export interface LineaPrefactura {
  referencia: string
  importe: number
}

export interface CuotaPendiente {
  id: string
  importe: number
  fecha_prevista: string
  clienteNombre?: string | null
  clienteEmpresa?: string | null
  cups?: string | null
  comercializadora?: string | null
}

export type EstadoMatch = 'confirmado' | 'importe_distinto' | 'sin_correspondencia'

export interface MatchLinea {
  lineaIndex: number
  linea: LineaPrefactura
  estado: EstadoMatch
  cuota: CuotaPendiente | null
  diferenciaImporte?: number // linea.importe - cuota.importe, solo si hay cuota candidata
}

export interface ResultadoConciliacion {
  matches: MatchLinea[]            // uno por línea de la prefactura, en orden original
  cuotasSinLinea: CuotaPendiente[] // pendientes que ninguna línea reclamó — señal de riesgo
}

const TOLERANCIA_IMPORTE_EUR = 0.05
const UMBRAL_TEXTO = 0.5

const DIACRITICS_RANGE = String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f)
const DIACRITICS_RE = new RegExp('[' + DIACRITICS_RANGE + ']', 'g')

function normalizar(s: string): string {
  return s.normalize('NFD').replace(DIACRITICS_RE, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokens(s: string): string[] {
  return normalizar(s).split(' ').filter(t => t.length >= 3)
}

function textoIdentificativo(c: CuotaPendiente): string {
  return [c.clienteNombre, c.clienteEmpresa, c.cups, c.comercializadora].filter(Boolean).join(' ')
}

function textScore(referencia: string, cuota: CuotaPendiente): number {
  const hay = normalizar(textoIdentificativo(cuota))
  const ref = normalizar(referencia)
  if (!hay || !ref) return 0
  if (cuota.cups) {
    const cups = normalizar(cuota.cups)
    if (cups.length >= 18 && ref.includes(cups)) return 1
  }
  if (ref.length >= 5 && hay.includes(ref)) return 1
  if (hay.length >= 5 && ref.includes(hay)) return 1
  const refT = tokens(referencia)
  if (refT.length === 0) return 0
  const hayT = new Set(tokens(hay))
  return refT.filter(t => hayT.has(t)).length / refT.length
}

function mejorCandidato(
  linea: LineaPrefactura,
  disponibles: CuotaPendiente[],
): { cuota: CuotaPendiente; score: number; dentroTolerancia: boolean } | null {
  const scored = disponibles
    .map(cuota => ({ cuota, score: textScore(linea.referencia, cuota) }))
    .filter(x => x.score > 0)
  if (scored.length === 0) return null

  const conTolerancia = scored.filter(x =>
    x.score >= UMBRAL_TEXTO && Math.abs(x.cuota.importe - linea.importe) <= TOLERANCIA_IMPORTE_EUR)
  if (conTolerancia.length > 0) {
    conTolerancia.sort((a, b) => b.score - a.score)
    return { ...conTolerancia[0], dentroTolerancia: true }
  }

  const porTexto = scored.filter(x => x.score >= UMBRAL_TEXTO)
  if (porTexto.length > 0) {
    porTexto.sort((a, b) => b.score - a.score ||
      Math.abs(a.cuota.importe - linea.importe) - Math.abs(b.cuota.importe - linea.importe))
    return { ...porTexto[0], dentroTolerancia: false }
  }

  return null
}

export function conciliarPrefactura(
  lineas: LineaPrefactura[],
  cuotasPendientes: CuotaPendiente[],
): ResultadoConciliacion {
  // Resuelve primero las líneas con match más fuerte, para que una cuota no
  // se la "robe" una línea de menor confianza si compiten por la misma.
  const orden = lineas
    .map((linea, lineaIndex) => ({ linea, lineaIndex }))
    .sort((a, b) => (mejorCandidato(b.linea, cuotasPendientes)?.score ?? 0)
                   - (mejorCandidato(a.linea, cuotasPendientes)?.score ?? 0))

  const usados = new Set<string>()
  const porIndice = new Map<number, MatchLinea>()

  for (const { linea, lineaIndex } of orden) {
    const disponibles = cuotasPendientes.filter(c => !usados.has(c.id))
    const candidato = mejorCandidato(linea, disponibles)
    if (!candidato) {
      porIndice.set(lineaIndex, { lineaIndex, linea, estado: 'sin_correspondencia', cuota: null })
      continue
    }
    usados.add(candidato.cuota.id)
    porIndice.set(lineaIndex, {
      lineaIndex,
      linea,
      cuota: candidato.cuota,
      estado: candidato.dentroTolerancia ? 'confirmado' : 'importe_distinto',
      diferenciaImporte: candidato.dentroTolerancia ? undefined : linea.importe - candidato.cuota.importe,
    })
  }

  return {
    matches: lineas.map((_, i) => porIndice.get(i)!),
    cuotasSinLinea: cuotasPendientes.filter(c => !usados.has(c.id)),
  }
}
