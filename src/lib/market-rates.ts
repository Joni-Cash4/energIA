// Tarifas reguladas BOE 2026 + Atulado — portado 1:1 desde el sistema Python
// probado en producción: C:\MonitorizacionEnergetica\sistema\core\fuentes_mercado.py
// y C:\MonitorizacionEnergetica\sistema\modules\tarifas_atulado.py
//
// NO modificar valores sin confirmar contra Resolución CNMC / Orden TED del año
// correspondiente. Actualización anual en enero.

export type Tarifa = '2.0TD' | '3.0TD' | '6.1TD'
export type Periodo = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6'

const P3_6: Periodo[] = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']
const P3_3: Periodo[] = ['P1', 'P2', 'P3']

export const PERIODOS_TARIFA: Record<Tarifa, Periodo[]> = {
  '2.0TD': P3_3,
  '3.0TD': P3_6,
  '6.1TD': P3_6,
}

// ─── Peajes + cargos de ENERGÍA (€/kWh) — BOE / Resolución CNMC dic. 2025 ────
export const PEAJES_ENERGIA_2026: Record<Tarifa, Partial<Record<Periodo, number>>> = {
  '2.0TD': { P1: 0.027511, P2: 0.012378, P3: 0.000031 },
  '3.0TD': { P1: 0.027511, P2: 0.012378, P3: 0.006800, P4: 0.001900, P5: 0.000600, P6: 0.000031 },
  '6.1TD': { P1: 0.014800, P2: 0.009100, P3: 0.003200, P4: 0.001400, P5: 0.000500, P6: 0.000030 },
}

export const CARGOS_ENERGIA_2026: Record<Tarifa, Partial<Record<Periodo, number>>> = {
  '2.0TD': { P1: 0.035841, P2: 0.026538, P3: 0.002867 },
  '3.0TD': { P1: 0.035841, P2: 0.026538, P3: 0.019700, P4: 0.010400, P5: 0.002867, P6: 0.002867 },
  '6.1TD': { P1: 0.022000, P2: 0.015000, P3: 0.008000, P4: 0.004000, P5: 0.001500, P6: 0.000800 },
}

// ─── Peajes + cargos de POTENCIA (€/kW·año) — dividir /365 para €/kW·día ────
export const PEAJES_POTENCIA_2026: Record<Tarifa, Partial<Record<Periodo, number>>> = {
  '2.0TD': { P1: 30.6726, P2: 1.9555, P3: 0.8911 },
  '3.0TD': { P1: 14.9351, P2: 7.8943, P3: 2.5030, P4: 1.9078, P5: 0.5353, P6: 0.5353 }, // BOE-A-2025-26348 (Resolución CNMC dic. 2025)
  '6.1TD': { P1: 9.4313, P2: 4.8776, P3: 1.3978, P4: 0.8819, P5: 0.4759, P6: 0.4441 },
}

export const CARGOS_POTENCIA_2026: Record<Tarifa, Partial<Record<Periodo, number>>> = {
  '2.0TD': { P1: 17.3228, P2: 1.1048, P3: 0.5034 },
  '3.0TD': { P1: 5.4418, P2: 2.7232, P3: 1.9785, P4: 1.9784, P5: 1.9784, P6: 0.9068 }, // cargos ajustados a Row1 exacto; P6 corregido
  '6.1TD': { P1: 4.4626, P2: 2.1072, P3: 0.7155, P4: 0.4533, P5: 0.2431, P6: 0.1849 },
}

// ─── CAP — pagos por capacidad (€/kWh) — BOE 2026, fallback si ESIOS no disponible
export const CAP_2026 = 0.00112

// CAP real mensual confirmado (ESIOS, vía informes generados con C:\MonitorizacionEnergetica).
// Vercel no tiene acceso a ESIOS — estos valores se actualizan a mano cuando Jonathan
// comparte un informe real. Si el mes no está aquí, se usa CAP_2026 (BOE) como fallback.
export const CAP_REAL_MENSUAL: Record<string, number> = {
  '2026-03': 0.00101, // confirmado: comparativa_ES0021000020343459NW_20260616_cliente.pdf
}

// ─── PERD — coeficiente de pérdidas por periodo (valor por defecto regulatorio) ─
// Esto es solo un FALLBACK. El valor real (COF2TD vía ESIOS PVPCDATA) varía mes a mes
// y puede diferir significativamente (~10%+) de este valor por defecto — validado contra
// factura real marzo 2026: con PERD por defecto el error en la simulación indexada fue
// del 8.6%, fuera del objetivo del 3%. Sin acceso a ESIOS desde Vercel, no podemos
// calcularlo en vivo — solo se puede mejorar pegando aquí valores reales que Jonathan
// obtenga de su sistema Python (ya los imprime: "PERD real PVPCDATA: COF2TD=...→PERD=...").
export const PERD_DEFECTO: Record<Tarifa, Partial<Record<Periodo, number>>> = {
  '2.0TD': { P1: 1.062, P2: 1.058, P3: 1.052 },
  '3.0TD': { P1: 1.062, P2: 1.058, P3: 1.055, P4: 1.055, P5: 1.055, P6: 1.052 },
  '6.1TD': { P1: 1.045, P2: 1.042, P3: 1.040, P4: 1.040, P5: 1.040, P6: 1.038 },
}

// PERD real mensual confirmado — rellenar solo con valores que vengan directamente
// de la salida del sistema Python (ESIOS PVPCDATA), nunca estimados a mano.
export const PERD_REAL_MENSUAL: Record<string, Partial<Record<Tarifa, Partial<Record<Periodo, number>>>>> = {
  // PERD real ESIOS PVPCDATA — del sistema Python local (C:\MonitorizacionEnergetica).
  // IMPORTANTE: NO son los Ki de la factura de Acciona (esos son propios de Acciona).
  // El PERD de ESIOS es el que usa Próxima para calcular su indexada.
  // Actualizar mensualmente cuando Jonathan comparte informes Python o sincroniza Supabase.
  '2026-03': { '3.0TD': { P1: 1.040, P2: 1.040, P3: 1.040, P4: 1.040, P5: 1.040, P6: 1.040 } }, // confirmado Python: comparativa MIMIPAU 20260616
}

// ─── SC — servicios de ajuste (€/kWh) — histórico mensual ────────────────────
// Valores marcados "confirmado" vienen de salidas reales de ESIOS (vía informes
// compartidos). El resto son estimaciones — sustituir en cuanto haya dato real.
export const SC_ESTIMADO_MENSUAL: Record<string, number> = {
  '2026-01': 0.01500,
  '2026-02': 0.00743, // confirmado ESIOS real feb 2026
  '2026-03': 0.00743, // confirmado: comparativa_ES0021000020343459NW_20260616_cliente.pdf
  '2026-04': 0.01000,
  '2026-05': 0.00900,
  '2026-06': 0.01000,
}
export const SC_FALLBACK = 0.010

// ─── Horas por periodo tarifario (España peninsular) ─────────────────────────
export const HORAS_PERIODO: Record<Tarifa, Partial<Record<Periodo, number[]>>> = {
  '3.0TD': {
    P1: [9, 10, 11, 12, 13, 18, 19, 20, 21],
    P2: [8, 14, 15, 16, 17, 22, 23],
    P3: [0, 1, 2, 3, 4, 5, 6, 7],
    P6: [0, 1, 2, 3, 4, 5, 6, 7], // fines de semana/festivos — simplificado igual que sistema fuente
  },
  '2.0TD': {
    P1: [9, 10, 11, 12, 13, 18, 19, 20, 21],
    P2: [8, 14, 15, 16, 17, 22, 23],
    P3: [0, 1, 2, 3, 4, 5, 6, 7],
  },
  '6.1TD': {
    P1: [9, 10, 11, 12, 13, 18, 19, 20, 21],
    P2: [8, 14, 15, 16, 17, 22, 23],
    P3: [0, 1, 2, 3, 4, 5, 6, 7],
  },
}

// ─── PRÓXIMA CRISTALINA — fee + otros costes pass-through ────────────────────
export const PROXIMA_CRISTALINA = {
  fee_kwh: 0.007,       // €/kWh — cargo por gestión, confirmado factura real
  fnee_kwh: 0.001521,   // Fondo nacional eficiencia energética
  go_kwh: 0.000770,     // Garantía de origen 100% renovable
  bono_dia: 0.019121,   // Financiación bono social €/día
  tasas_pct: 0.015,     // 1.5% sobre componente mercado + fee
}

// ─── ATULADO — tarifas fijas vigentes ─────────────────────────────────────────
// energia y potencia en €/kWh y €/kW·día respectivamente
export const ATULADO_BOE = {
  nombre: 'Discriminación horaria BOE',
  vigencia: '01/04/2026',
  energia: {
    '2.0TD': { P1: 0.195123, P2: 0.124301, P3: 0.097946 },
    '3.0TD': { P1: 0.146823, P2: 0.117103, P3: 0.105849, P4: 0.085249, P5: 0.080296, P6: 0.107601 },
    '6.1TD': { P1: 0.121455, P2: 0.097104, P3: 0.092697, P4: 0.076379, P5: 0.069137, P6: 0.093451 },
  } as Record<Tarifa, Partial<Record<Periodo, number>>>,
  potencia: {
    '2.0TD': { P1: 0.073783, P2: 0.001912, P3: 0.0 },
    '3.0TD': { P1: 0.053857, P2: 0.028087, P3: 0.011679, P4: 0.010087, P5: 0.006378, P6: 0.003715 },
    '6.1TD': { P1: 0.078882, P2: 0.041309, P3: 0.017969, P4: 0.014169, P5: 0.005295, P6: 0.002509 },
  } as Record<Tarifa, Partial<Record<Periodo, number>>>,
}

export const ATULADO_WEB = {
  nombre: 'Discriminación horaria WEB',
  vigencia: '01/07/2026', // Precio Fijo Atulado POT Web, revisión trimestral 01/07/2026-30/09/2026
  energia: {
    '2.0TD': { P1: 0.242430, P2: 0.163363, P3: 0.138409 }, // 2.0TD DH Empresas
    '3.0TD': { P1: 0.200568, P2: 0.184159, P3: 0.15916, P4: 0.143648, P5: 0.136003, P6: 0.186337 },
    '6.1TD': { P1: 0.132394, P2: 0.108043, P3: 0.103636, P4: 0.087318, P5: 0.080076, P6: 0.10439 },
  } as Record<Tarifa, Partial<Record<Periodo, number>>>,
  potencia: {
    '2.0TD': { P1: 0.103717, P2: 0.041623, P3: 0.0 },
    '3.0TD': { P1: 0.059999, P2: 0.032983, P3: 0.021735, P4: 0.015654, P5: 0.009391, P6: 0.006219 },
    '6.1TD': { P1: 0.085255, P2: 0.046400, P3: 0.028092, P4: 0.019784, P5: 0.008326, P6: 0.005254 },
  } as Record<Tarifa, Partial<Record<Periodo, number>>>,
}

// 2.0TD Empresas Atulado WEB tiene DOS variantes con la misma vigencia (01/07/2026-
// 30/09/2026): plana (mismo precio los 3 periodos) o discriminada por horas (arriba,
// en ATULADO_WEB.energia['2.0TD']). Cuál compensa depende del reparto de consumo del
// cliente entre P1/P2/P3 — process-invoice simula ambas y usa la mas barata para cada
// cliente, igual que ya se hace para elegir entre BOE y WEB.
export const ATULADO_WEB_PLANO_2TD = { P1: 0.168827, P2: 0.168827, P3: 0.168827 }

// Umbral de selección automática BOE vs WEB (kWh/kW·mes)
export const UMBRAL_KWH_POR_KW = 50.0

export function normalizaTarifa(t: string | undefined | null): Tarifa {
  const up = (t ?? '').toUpperCase()
  if (up.startsWith('2.0')) return '2.0TD'
  if (up.startsWith('6.1')) return '6.1TD'
  return '3.0TD'
}
