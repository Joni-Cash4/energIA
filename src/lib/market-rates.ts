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
// 2.0TD y 6.1TD: total combinado (peaje+cargo) sin desglosar, tomado de la tabla
// BOE €/kW·día de Jonathan (confirmada 2026-07-21, ×365) — todo bajo PEAJES,
// CARGOS a 0 hasta tener el reparto oficial exacto. 2.0TD solo factura potencia
// en P1/P2 (P3 no aplica). 3.0TD sí tiene el reparto real (BOE-A-2025-26348).
export const PEAJES_POTENCIA_2026: Record<Tarifa, Partial<Record<Periodo, number>>> = {
  '2.0TD': { P1: 27.7046, P2: 0.7253 },
  '3.0TD': { P1: 14.9351, P2: 7.8943, P3: 2.5030, P4: 1.9078, P5: 0.5353, P6: 0.5353 }, // BOE-A-2025-26348 (Resolución CNMC dic. 2025)
  '6.1TD': { P1: 29.5953, P2: 15.5147, P3: 6.8018, P4: 5.3940, P5: 2.1250, P6: 1.0041 },
}

export const CARGOS_POTENCIA_2026: Record<Tarifa, Partial<Record<Periodo, number>>> = {
  '2.0TD': {},
  '3.0TD': { P1: 5.4418, P2: 2.7232, P3: 1.9785, P4: 1.9784, P5: 1.9784, P6: 0.9068 }, // cargos ajustados a Row1 exacto; P6 corregido
  '6.1TD': {},
}

// ─── CAP — pagos por capacidad (€/kWh) ───────────────────────────────────────
// Mismo criterio que el SC: dato real de ESIOS PVPCDATA (PCAPPCB, media del mes), copia
// de mercado_sc_cap (ADR-0008). Supabase manda (market-real.ts): esto solo se usa si no
// responde o si el mes no tiene dato. Hasta el 2026-09-15 el fallback era 0,00112 (BOE)
// y marzo de 2026 tenía 0,00101 de los indicadores sin geo: unas cuatro veces el real.
// Mes sin dato: media de los 12 últimos meses reales (sep-2025 a ago-2026).
export const CAP_2026 = 0.000258

export const CAP_REAL_MENSUAL: Record<string, number> = {
  '2025-01': 0.000264,
  '2025-02': 0.000277,
  '2025-03': 0.000262,
  '2025-04': 0.000282,
  '2025-05': 0.000257,
  '2025-06': 0.000263,
  '2025-07': 0.000279,
  '2025-08': 0.000243,
  '2025-09': 0.000275,
  '2025-10': 0.000281,
  '2025-11': 0.000254,
  '2025-12': 0.000261,
  '2026-01': 0.000238,
  '2026-02': 0.000262,
  '2026-03': 0.000261,
  '2026-04': 0.000267,
  '2026-05': 0.000232,
  '2026-06': 0.000261,
  '2026-07': 0.000264,
  '2026-08': 0.000242,
}

// ─── PERD — coeficiente de pérdidas (tanto por uno) ──────────────────────────
// Dato real de ESIOS PVPCDATA: PERD = (1 + media del mes de COF2TD) × 1,04, el mismo
// para las 3 tarifas y los 6 periodos (ADR-0006). Es copia de mercado_perd; Supabase
// manda (market-real.ts). OJO: no son los Ki de la factura de cada comercializadora.
// Hasta el 2026-09-15 el fallback era un valor por defecto regulatorio (1,038 a 1,062
// según tarifa y periodo), no un dato real: con él, la simulación indexada de marzo de
// 2026 se desviaba un 8,6 % de la factura real.
const TARIFAS_PERIODOS: Record<Tarifa, Periodo[]> = {
  '2.0TD': ['P1', 'P2', 'P3'],
  '3.0TD': ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
  '6.1TD': ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
}
function perdIgual(v: number): Record<Tarifa, Partial<Record<Periodo, number>>> {
  return Object.fromEntries(
    Object.entries(TARIFAS_PERIODOS).map(([t, ps]) => [t, Object.fromEntries(ps.map((p) => [p, v]))]),
  ) as Record<Tarifa, Partial<Record<Periodo, number>>>
}

// Mes sin dato: media de los 12 últimos meses reales (sep-2025 a ago-2026).
export const PERD_DEFECTO: Record<Tarifa, Partial<Record<Periodo, number>>> = perdIgual(1.040123)

const PERD_MES: Record<string, number> = {
  '2025-01': 1.040148,
  '2025-02': 1.040137,
  '2025-03': 1.040123,
  '2025-04': 1.040107,
  '2025-05': 1.040098,
  '2025-06': 1.040105,
  '2025-07': 1.040127,
  '2025-08': 1.040125,
  '2025-09': 1.040107,
  '2025-10': 1.040103,
  '2025-11': 1.040121,
  '2025-12': 1.040141,
  '2026-01': 1.040151,
  '2026-02': 1.040141,
  '2026-03': 1.040126,
  '2026-04': 1.040108,
  '2026-05': 1.040101,
  '2026-06': 1.040112,
  '2026-07': 1.040131,
  '2026-08': 1.040130,
}
export const PERD_REAL_MENSUAL: Record<string, Partial<Record<Tarifa, Partial<Record<Periodo, number>>>>> =
  Object.fromEntries(Object.entries(PERD_MES).map(([mes, v]) => [mes, perdIgual(v)]))

// ─── SC — servicios de ajuste (€/kWh) — histórico mensual ────────────────────
// Copia de mercado_sc_cap en Supabase: ESIOS PVPCDATA (archivo 70), media del mes de
// SAHPCB + FOMPCB + FOSPCB + INTPCB + EDSRPCB (ver ADR-0008 y el cron
// mercado-perd-sync). Supabase manda (market-real.ts): esto solo se usa si no responde.
// Hasta el 2026-09-15 aquí había estimaciones o valores de los indicadores 1739-1746
// sin filtro de geo (sistemas insulares, ADR-0008), de 7 a 15 €/MWh: estaban mal.
export const SC_ESTIMADO_MENSUAL: Record<string, number> = {
  '2025-01': 0.016990,
  '2025-02': 0.016656,
  '2025-03': 0.018601,
  '2025-04': 0.024908,
  '2025-05': 0.036204,
  '2025-06': 0.020606,
  '2025-07': 0.018676,
  '2025-08': 0.019560,
  '2025-09': 0.022229,
  '2025-10': 0.023765,
  '2025-11': 0.025651,
  '2025-12': 0.023218,
  '2026-01': 0.023801,
  '2026-02': 0.036096,
  '2026-03': 0.038976,
  '2026-04': 0.029955,
  '2026-05': 0.027105,
  '2026-06': 0.021803,
  '2026-07': 0.021474,
  '2026-08': 0.021739,
}
// Mes sin dato (ej. el mes en curso, antes de que corra el cron): media de los 12
// últimos meses reales, sep-2025 a ago-2026 (26,3 €/MWh). Antes era 0,010, de la
// misma fuente errónea. También lo usa el simulador del dashboard.
export const SC_FALLBACK = 0.0263

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

// ─── Fee del asesor para el comparador PÚBLICO (clientes desde casa) ─────────
// Criterio Jonathan 2026-07-14: energía 10 €/MWh, potencia 0. El dashboard
// interno NO usa esto — allí el fee sale del campo ajustable de cada página.
export const FEE_PUBLICO_ENERGIA_MWH = 10

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
