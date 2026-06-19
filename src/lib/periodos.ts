/**
 * Asignación de periodos tarifarios — BOE-A-2001-20850 / CNMC Circular 3/2020
 * Soporta Península, Canarias y Baleares con sus tablas exactas.
 *
 * Reglas comunes a todas las zonas:
 *   - Valle 00-08h → P6 siempre
 *   - Sáb/Dom/Festivo → P6 todo el día
 *   - Laborable punta → P1/P2/P3/P4 según temporada
 *   - Laborable llano → P2/P3/P4/P5 según temporada
 *
 * Las zonas difieren en: (1) qué mes es qué temporada, (2) horas de punta.
 */

import type { Periodo } from './market-rates'

export type Zona = 'PENINSULA' | 'CANARIAS' | 'BALEARES'

// ── Festivos nacionales España — actualizar en enero de cada año ──────────────
export const FESTIVOS_NACIONALES = new Set([
  // 2025
  '2025-01-01','2025-01-06','2025-04-17','2025-04-18','2025-05-01',
  '2025-08-15','2025-10-12','2025-11-01','2025-12-06','2025-12-08','2025-12-25',
  // 2026
  '2026-01-01','2026-01-06','2026-04-02','2026-04-03','2026-05-01',
  '2026-08-15','2026-10-12','2026-11-01','2026-12-06','2026-12-08','2026-12-25',
  // 2027
  '2027-01-01','2027-01-06','2027-03-25','2027-03-26','2027-05-01',
  '2027-08-15','2027-10-12','2027-11-01','2027-12-06','2027-12-08','2027-12-25',
])

// ── Temporadas por zona y mes ─────────────────────────────────────────────────
// 0=Alta | 1=Media-Alta | 2=Media | 3=Baja
type TemporadaIdx = 0 | 1 | 2 | 3

const TEMPORADA: Record<Zona, Record<number, TemporadaIdx>> = {
  PENINSULA: {
    1:0, 2:0, 7:0, 12:0,  // Alta
    3:1, 11:1,             // Media-Alta
    6:2, 8:2, 9:2,         // Media
    4:3, 5:3, 10:3,        // Baja
  },
  CANARIAS: {
    7:0, 8:0, 9:0, 10:0,   // Alta
    11:1, 12:1,            // Media-Alta
    1:2, 2:2, 3:2,         // Media
    4:3, 5:3, 6:3,         // Baja
  },
  BALEARES: {
    6:0, 7:0, 8:0, 9:0,    // Alta
    5:1, 10:1,             // Media-Alta
    1:2, 2:2, 12:2,        // Media
    3:3, 4:3, 11:3,        // Baja
  },
}

// ── Horas punta por zona ──────────────────────────────────────────────────────
// Laborable punta: Península 09-14h y 18-22h | Canarias/Baleares 10-15h y 18-22h
function esPunta(hora: number, zona: Zona): boolean {
  if (zona === 'PENINSULA') {
    return (hora >= 9 && hora < 14) || (hora >= 18 && hora < 22)
  }
  // Canarias y Baleares: 10-15h y 18-22h
  return (hora >= 10 && hora < 15) || (hora >= 18 && hora < 22)
}

// ── Periodo por temporada y franja ────────────────────────────────────────────
const PUNTA_PERIODO:  Periodo[] = ['P1', 'P2', 'P3', 'P4'] // [Alta, M-Alta, Media, Baja]
const LLANO_PERIODO:  Periodo[] = ['P2', 'P3', 'P4', 'P5']

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Devuelve el periodo tarifario (P1-P6) para una fecha y hora dadas.
 * @param fecha  Objeto Date (hora local española)
 * @param hora   Hora del día 0-23 (hora local España)
 * @param tarifa '3.0TD' | '2.0TD' | '6.1TD'
 * @param zona   Zona geográfica del suministro (por defecto PENINSULA)
 */
export function getPeriodo(fecha: Date, hora: number, tarifa: string, zona: Zona = 'PENINSULA'): Periodo {
  const diaSemana = fecha.getDay() // 0=domingo … 6=sábado
  const fechaStr  = fecha.toISOString().slice(0, 10)
  const esFestivo = FESTIVOS_NACIONALES.has(fechaStr)
  const mes       = fecha.getMonth() + 1 // 1-12

  if (tarifa === '2.0TD') {
    // 2.0TD: sin distinción de zona ni temporada, solo laborable vs finde/festivo
    if (diaSemana === 0 || diaSemana === 6 || esFestivo) return 'P3'
    if (hora < 8) return 'P3'
    if ((hora >= 9 && hora < 14) || (hora >= 18 && hora < 22)) return 'P1'
    return 'P2'
  }

  // 3.0TD / 6.1TD
  if (hora < 8) return 'P6'                                        // valle → P6 siempre
  if (diaSemana === 0 || diaSemana === 6 || esFestivo) return 'P6' // finde/festivo → P6

  // Laborable, hora 8-24: determinar temporada y franja
  const temp: TemporadaIdx = TEMPORADA[zona][mes] ?? 0
  return esPunta(hora, zona) ? PUNTA_PERIODO[temp] : LLANO_PERIODO[temp]
}

/**
 * Detecta la zona geográfica a partir del CUPS.
 * - Distribuidoras de Canarias usan empresa "11" en posiciones 3-4 del CUPS.
 * - Distribuidoras de Baleares usan empresa "03" y ciertas zonas específicas.
 * Si no se puede determinar con certeza, devuelve 'PENINSULA'.
 */
export function getZonaFromCups(cups: string | null | undefined): Zona {
  if (!cups) return 'PENINSULA'
  const c = cups.toUpperCase().replace(/\s/g, '')
  if (!c.startsWith('ES') || c.length < 6) return 'PENINSULA'

  // Código de empresa distribuidor: posiciones 3-6 (tras "ES")
  const empresa = c.slice(2, 6)

  // Canarias: empresas distribuidoras 1130 (Endesa Distribución Canarias),
  // 1131, 1132, 1133, 1190, 1191, etc. — primer dígito 1 + segundo 1
  if (empresa.startsWith('11')) return 'CANARIAS'

  // Baleares: empresa 0313 (Endesa Distribución Baleares)
  if (empresa === '0313') return 'BALEARES'

  return 'PENINSULA'
}

/**
 * Devuelve la temporada de un mes para una zona dada.
 */
export function getTemporada(mes: number, zona: Zona = 'PENINSULA'): 'alta' | 'media_alta' | 'media' | 'baja' {
  const idx = TEMPORADA[zona][mes] ?? 0
  return (['alta', 'media_alta', 'media', 'baja'] as const)[idx]
}
