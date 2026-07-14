'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sliders } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatNumber } from '@/lib/utils'
import {
  PEAJES_ENERGIA_2026, CARGOS_ENERGIA_2026,
  PEAJES_POTENCIA_2026, CARGOS_POTENCIA_2026,
  CAP_2026, SC_FALLBACK, PERD_DEFECTO, PROXIMA_CRISTALINA,
  type Tarifa,
} from '@/lib/market-rates'

// Precios reales Próxima Cristalina por periodo (€/kWh, ya incluye todo:
// PERD×(OMIE+SC+CAP)+peajes+cargos+fee+tasas). Fuente: Simulador tarifas
// agentesBoeWeb 2605.xlsx, hoja "Precios energia". None = periodo sin datos ese mes.
type PP = { P1?: number; P2?: number; P3?: number; P4?: number; P5?: number; P6?: number }
type EntradaHist = { label: string; year: number; '2.0TD': PP; '3.0TD': PP; '6.1TD': PP }

const PRECIOS_HIST: Record<string, EntradaHist> = {
  '2023ENERO':      { label:'Ene 2023', year:2023, '2.0TD':{P1:0.193049,P2:0.132741,P3:0.060797}, '3.0TD':{}, '6.1TD':{} },
  '2023FEBRERO':    { label:'Feb 2023', year:2023, '2.0TD':{P1:0.252914,P2:0.201979,P3:0.165012}, '3.0TD':{}, '6.1TD':{} },
  '2023MARZO':      { label:'Mar 2023', year:2023, '2.0TD':{P1:0.166497,P2:0.120925,P3:0.110769}, '3.0TD':{P1:0.165556,P2:0.137594,P6:0.059992}, '6.1TD':{P1:0.141607,P2:0.117941,P6:0.053354} },
  '2023ABRIL':      { label:'Abr 2023', year:2023, '2.0TD':{P1:0.158642,P2:0.101183,P3:0.080946}, '3.0TD':{P1:0.225487,P2:0.203434,P6:0.164207}, '6.1TD':{P1:0.197218,P2:0.177942,P6:0.146482} },
  '2023MAYO':       { label:'May 2023', year:2023, '2.0TD':{P1:0.170452,P2:0.117456,P3:0.103514}, '3.0TD':{P2:0.128820,P3:0.101615,P6:0.109964}, '6.1TD':{P2:0.110571,P3:0.089175,P6:0.099007} },
  '2023JUNIO':      { label:'Jun 2023', year:2023, '2.0TD':{P1:0.191183,P2:0.143011,P3:0.121102}, '3.0TD':{P4:0.099942,P5:0.066716,P6:0.080141}, '6.1TD':{P4:0.090336,P5:0.059843,P6:0.072480} },
  '2023JULIO':      { label:'Jul 2023', year:2023, '2.0TD':{P1:0.192225,P2:0.141150,P3:0.118004}, '3.0TD':{P4:0.107227,P5:0.088824,P6:0.102709}, '6.1TD':{P4:0.097573,P5:0.080120,P6:0.093690} },
  '2023AGOSTO':     { label:'Ago 2023', year:2023, '2.0TD':{P1:0.191798,P2:0.144444,P3:0.121651}, '3.0TD':{P3:0.133744,P4:0.123713,P6:0.120297}, '6.1TD':{P3:0.120200,P4:0.112745,P6:0.110107} },
  '2023SEPTIEMBRE': { label:'Sep 2023', year:2023, '2.0TD':{P1:0.197376,P2:0.149462,P3:0.126233}, '3.0TD':{P1:0.165472,P2:0.146645,P6:0.117199}, '6.1TD':{P1:0.143194,P2:0.127899,P6:0.107445} },
  '2023OCTUBRE':    { label:'Oct 2023', year:2023, '2.0TD':{P1:0.194329,P2:0.142339,P3:0.098614}, '3.0TD':{P3:0.135075,P4:0.125003,P6:0.120846}, '6.1TD':{P3:0.121109,P4:0.113862,P6:0.111080} },
  '2023NOVIEMBRE':  { label:'Nov 2023', year:2023, '2.0TD':{P1:0.157617,P2:0.118852,P3:0.040451}, '3.0TD':{P3:0.141529,P4:0.128088,P6:0.125428}, '6.1TD':{P3:0.127140,P4:0.116959,P6:0.114602} },
  '2023DICIEMBRE':  { label:'Dic 2023', year:2023, '2.0TD':{P1:0.182086,P2:0.137565,P3:0.083450}, '3.0TD':{P4:0.132394,P5:0.113803,P6:0.097809}, '6.1TD':{P4:0.121017,P5:0.102781,P6:0.089580} },
  '2024ENERO':      { label:'Ene 2024', year:2024, '2.0TD':{P1:0.185270,P2:0.132233,P3:0.095261}, '3.0TD':{P2:0.121200,P3:0.106911,P6:0.039646}, '6.1TD':{P2:0.103980,P3:0.093301,P6:0.036045} },
  '2024FEBRERO':    { label:'Feb 2024', year:2024, '2.0TD':{P1:0.132574,P2:0.078269,P3:0.039119}, '3.0TD':{P1:0.154267,P2:0.139527,P6:0.082645}, '6.1TD':{P1:0.131523,P2:0.118981,P6:0.073785} },
  '2024MARZO':      { label:'Mar 2024', year:2024, '2.0TD':{P1:0.102745,P2:0.051879,P3:0.026132}, '3.0TD':{P1:0.158432,P2:0.134083,P6:0.094701}, '6.1TD':{P1:0.134936,P2:0.114146,P6:0.083918} },
  '2024ABRIL':      { label:'Abr 2024', year:2024, '2.0TD':{P1:0.101985,P2:0.052301,P3:0.031614}, '3.0TD':{P1:0.104456,P2:0.082265,P6:0.038559}, '6.1TD':{P1:0.085681,P2:0.068044,P6:0.034590} },
  '2024MAYO':       { label:'May 2024', year:2024, '2.0TD':{P1:0.109277,P2:0.057105,P3:0.047456}, '3.0TD':{P2:0.056394,P3:0.040920,P6:0.025572}, '6.1TD':{P2:0.045040,P3:0.034542,P6:0.023091} },
  '2024JUNIO':      { label:'Jun 2024', year:2024, '2.0TD':{P1:0.145628,P2:0.095079,P3:0.056979}, '3.0TD':{P4:0.034830,P5:0.027504,P6:0.031054}, '6.1TD':{P4:0.030949,P5:0.024395,P6:0.028299} },
  '2024JULIO':      { label:'Jul 2024', year:2024, '2.0TD':{P1:0.166923,P2:0.121115,P3:0.097523}, '3.0TD':{P4:0.043369,P5:0.031662,P6:0.046896}, '6.1TD':{P4:0.038711,P5:0.028273,P6:0.042592} },
  '2024AGOSTO':     { label:'Ago 2024', year:2024, '2.0TD':{P1:0.197743,P2:0.146671,P3:0.124385}, '3.0TD':{P3:0.088573,P4:0.075797,P6:0.056419}, '6.1TD':{P3:0.078939,P4:0.068852,P6:0.051870} },
  '2024SEPTIEMBRE': { label:'Sep 2024', year:2024, '2.0TD':{P1:0.170569,P2:0.103993,P3:0.091553}, '3.0TD':{P1:0.144537,P2:0.122437,P6:0.096963}, '6.1TD':{P1:0.123740,P2:0.105791,P6:0.088983} },
  '2024OCTUBRE':    { label:'Oct 2024', year:2024, '2.0TD':{P1:0.178607,P2:0.122193,P3:0.090574}, '3.0TD':{P3:0.138055,P4:0.128771,P6:0.123825}, '6.1TD':{P3:0.124164,P4:0.117606,P6:0.113149} },
  '2024NOVIEMBRE':  { label:'Nov 2024', year:2024, '2.0TD':{P1:0.230637,P2:0.188927,P3:0.146476}, '3.0TD':{P3:0.110701,P4:0.079727,P6:0.090993}, '6.1TD':{P3:0.099350,P4:0.072806,P6:0.083570} },
  '2024DICIEMBRE':  { label:'Dic 2024', year:2024, '2.0TD':{P1:0.240709,P2:0.199926,P3:0.153646}, '3.0TD':{P4:0.116094,P5:0.094197,P6:0.090014}, '6.1TD':{P4:0.106426,P5:0.084974,P6:0.081576} },
  '2025ENERO':      { label:'Ene 2025', year:2025, '2.0TD':{P1:0.248549,P2:0.177862,P3:0.108154}, '3.0TD':{P2:0.185923,P3:0.178239,P6:0.145916}, '6.1TD':{P2:0.162870,P3:0.157550,P6:0.131234} },
  '2025FEBRERO':    { label:'Feb 2025', year:2025, '2.0TD':{P1:0.233550,P2:0.161959,P3:0.147474}, '3.0TD':{P1:0.214972,P2:0.203071,P6:0.153086}, '6.1TD':{P1:0.186559,P2:0.176383,P6:0.135857} },
  '2025MARZO':      { label:'Mar 2025', year:2025, '2.0TD':{P1:0.159914,P2:0.078655,P3:0.053746}, '3.0TD':{P1:0.217297,P2:0.187762,P6:0.107791}, '6.1TD':{P1:0.186725,P2:0.159811,P6:0.095884} },
  '2025ABRIL':      { label:'Abr 2025', year:2025, '2.0TD':{P1:0.126792,P2:0.058059,P3:0.055156}, '3.0TD':{P1:0.204550,P2:0.169215,P6:0.147111}, '6.1TD':{P1:0.175604,P2:0.145094,P6:0.131167} },
  '2025MAYO':       { label:'May 2025', year:2025, '2.0TD':{P1:0.134524,P2:0.068440,P3:0.061906}, '3.0TD':{P2:0.098129,P3:0.069490,P6:0.053383}, '6.1TD':{P2:0.080899,P3:0.059217,P6:0.047583} },
  '2025JUNIO':      { label:'Jun 2025', year:2025, '2.0TD':{P1:0.164949,P2:0.086556,P3:0.087809}, '3.0TD':{P4:0.044339,P5:0.032957,P6:0.054793}, '6.1TD':{P4:0.038788,P5:0.028975,P6:0.049454} },
  '2025JULIO':      { label:'Jul 2025', year:2025, '2.0TD':{P1:0.170902,P2:0.106616,P3:0.092955}, '3.0TD':{P4:0.051079,P5:0.043294,P6:0.061543}, '6.1TD':{P4:0.045526,P5:0.038581,P6:0.055924} },
  '2025AGOSTO':     { label:'Ago 2025', year:2025, '2.0TD':{P1:0.163227,P2:0.094207,P3:0.105604}, '3.0TD':{P3:0.091519,P4:0.057005,P6:0.087446}, '6.1TD':{P3:0.080498,P4:0.051122,P6:0.080734} },
  '2025SEPTIEMBRE': { label:'Sep 2025', year:2025, '2.0TD':{P1:0.134168,P2:0.065401,P3:0.075204}, '3.0TD':{P1:0.140771,P2:0.115429,P6:0.092592}, '6.1TD':{P1:0.118313,P2:0.098030,P6:0.084723} },
  '2025OCTUBRE':    { label:'Oct 2025', year:2025, '2.0TD':{P1:0.188741,P2:0.122503,P3:0.103320}, '3.0TD':{P3:0.097398,P4:0.072881,P6:0.107341}, '6.1TD':{P3:0.085987,P4:0.065523,P6:0.097962} },
  '2025NOVIEMBRE':  { label:'Nov 2025', year:2025, '2.0TD':{P1:0.152074,P2:0.103278,P3:0.078657}, '3.0TD':{P3:0.061030,P4:0.048686,P6:0.076941}, '6.1TD':{P3:0.052358,P4:0.043232,P6:0.070253} },
  '2025DICIEMBRE':  { label:'Dic 2025', year:2025, '2.0TD':{P1:0.220362,P2:0.157264,P3:0.110545}, '3.0TD':{P4:0.113278,P5:0.091908,P6:0.105057}, '6.1TD':{P4:0.102582,P5:0.082971,P6:0.095813} },
  '2026ENERO':      { label:'Ene 2026', year:2026, '2.0TD':{P1:0.215197,P2:0.133799,P3:0.080953}, '3.0TD':{P2:0.101165,P3:0.095438,P6:0.080394}, '6.1TD':{P2:0.084949,P3:0.083963,P6:0.072771} },
  '2026FEBRERO':    { label:'Feb 2026', year:2026, '2.0TD':{P1:0.143951,P2:0.074687,P3:0.050232}, '3.0TD':{P1:0.191884,P2:0.167524,P6:0.112282}, '6.1TD':{P1:0.164442,P2:0.144780,P6:0.101517} },
  '2026MARZO':      { label:'Mar 2026', year:2026, '2.0TD':{P1:0.148444,P2:0.079889,P3:0.062278}, '3.0TD':{P1:0.184025,P2:0.145366,P6:0.082659}, '6.1TD':{P1:0.156602,P2:0.123572,P6:0.073512} },
  '2026ABRIL':      { label:'Abr 2026', year:2026, '2.0TD':{P1:0.141357,P2:0.070296,P3:0.066902}, '3.0TD':{P1:0.112360,P2:0.087121,P6:0.051938}, '6.1TD':{P1:0.091276,P2:0.071185,P6:0.046478} },
  '2026MAYO':       { label:'May 2026', year:2026, '2.0TD':{}, '3.0TD':{P2:0.091270,P3:0.072860,P6:0.063984}, '6.1TD':{P2:0.074823,P3:0.062268,P6:0.057140} },
  '2026JUNIO':      { label:'Jun 2026', year:2026, '2.0TD':{}, '3.0TD':{P4:0.055876,P5:0.045961,P6:0.068608}, '6.1TD':{P4:0.049612,P5:0.040870,P6:0.062221} },
  'custom':         { label:'Personalizado', year:0, '2.0TD':{}, '3.0TD':{}, '6.1TD':{} },
}

// Meses disponibles ordenados cronológicamente (excluye futuro sin datos)
const MESES_DISPONIBLES = Object.keys(PRECIOS_HIST).filter(k => k !== 'custom')
const AÑOS_DISPONIBLES = [...new Set(MESES_DISPONIBLES.map(k => PRECIOS_HIST[k].year))].sort()

type PeriodoKey = keyof typeof PRECIOS_HIST

// Atulado tarifas vigentes — promedio simple energía, suma anual potencia
// BOE vigencia 01/04/2026 · WEB vigencia 01/10/2025
const ATULADO = {
  BOE: {
    '2.0TD': { e: 0.13912, p: 27.63 },
    '3.0TD': { e: 0.10715, p: 41.54 },
    '6.1TD': { e: 0.09170, p: 58.45 },
  },
  WEB: {
    '2.0TD': { e: 0.10887, p: 53.05 },
    '3.0TD': { e: 0.09984, p: 53.28 },
    '6.1TD': { e: 0.08764, p: 70.49 },
  },
} as const

// 2.0TD tiene dos productos: Milenial (precio plano) y DH (discriminación horaria).
// 3.0TD y 6.1TD solo tienen DH.
// Fuente: Excel "Simulador tarifas agentesBoeWeb 2605.xlsx"
//   BOE vigencia 01/04/2026 · WEB vigencia 01/10/2025
const ATULADO_MILENIAL = {
  BOE: { e: 0.129986, p: 27.63 },
  WEB: { e: 0.096686, p: 53.05 },
} as const

function getAtuladoRate(mod: 'BOE' | 'WEB', tarifa: Tarifa, tipo2td: 'DH' | 'Milenial') {
  if (tarifa === '2.0TD' && tipo2td === 'Milenial') return ATULADO_MILENIAL[mod]
  return ATULADO[mod][tarifa]
}

// Precios energía por periodo (€/kWh, sin fee) para la tabla de precios finales
// Fuente: Excel "Simulador tarifas agentesBoeWeb 2605.xlsx"
// pot: potencia €/kW·año por periodo (€/kW·día × 365, verificado contra totales de ATULADO)
const ATULADO_PERIODOS: Record<'BOE' | 'WEB', Record<Tarifa, { DH: PP; Milenial?: PP; pot: PP }>> = {
  BOE: {
    '2.0TD': {
      DH:       { P1: 0.195123, P2: 0.124301, P3: 0.097946 },
      Milenial: { P1: 0.129986, P2: 0.129986, P3: 0.129986 },
      pot:      { P1: 26.9310,  P2: 0.6980 },
    },
    '3.0TD': {
      DH:  { P1: 0.146823, P2: 0.117103, P3: 0.105849, P4: 0.085249, P5: 0.080296, P6: 0.107601 },
      pot: { P1: 19.6580,  P2: 10.2520,  P3: 4.2630,   P4: 3.6820,   P5: 2.3280,   P6: 1.3560  },
    },
    '6.1TD': {
      DH:  { P1: 0.121455, P2: 0.097104, P3: 0.092697, P4: 0.076379, P5: 0.069137, P6: 0.093451 },
      pot: { P1: 28.7920,  P2: 15.0780,  P3: 6.5590,   P4: 5.1720,   P5: 1.9330,   P6: 0.9160  },
    },
  },
  WEB: {
    '2.0TD': {
      DH:       { P1: 0.164870, P2: 0.094047, P3: 0.067692 },
      Milenial: { P1: 0.096686, P2: 0.096686, P3: 0.096686 },
      pot:      { P1: 37.8567,  P2: 15.1924 },
    },
    '3.0TD': {
      DH:  { P1: 0.139513, P2: 0.109794, P3: 0.098539, P4: 0.077939, P5: 0.072987, P6: 0.100292 },
      pot: { P1: 21.8997,  P2: 12.0390,  P3: 7.9333,   P4: 5.7137,   P5: 3.4276,   P6: 2.2701  },
    },
    '6.1TD': {
      DH:  { P1: 0.117394, P2: 0.093043, P3: 0.088636, P4: 0.072318, P5: 0.065076, P6: 0.089390 },
      pot: { P1: 31.1182,  P2: 16.9360,  P3: 10.2537,  P4: 7.2212,   P5: 3.0388,   P6: 1.9179  },
    },
  },
}

function getAtuladoPeriodos(mod: 'BOE' | 'WEB', tarifa: Tarifa, tipo2td: 'DH' | 'Milenial'): PP {
  const entry = ATULADO_PERIODOS[mod][tarifa]
  if (tarifa === '2.0TD' && tipo2td === 'Milenial' && entry.Milenial) return entry.Milenial
  return entry.DH
}

const TARIFAS: Tarifa[] = ['2.0TD', '3.0TD', '6.1TD']
const UMBRAL_KWH_POR_KW = 50

// ── helpers ──────────────────────────────────────────────────────────────────
function vv(obj: Partial<Record<string, number>>): number[] {
  return Object.values(obj).filter((v): v is number => v !== undefined)
}
const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
const sumV = (a: number[]) => a.reduce((s, v) => s + v, 0)

function getIvaRate(tarifa: Tarifa) { return tarifa === '2.0TD' ? 0.10 : 0.21 }

function withImpuestos(sub: number, iv: number) {
  const iee = sub * 0.0064
  const baseIva = sub + iee
  const ivaAmt = baseIva * iv
  return { iee, ivaAmt, total: baseIva + ivaAmt }
}

// ── cálculos principales ──────────────────────────────────────────────────────
function getKwPeriodNames(tarifa: Tarifa): string[] {
  return tarifa === '2.0TD' ? ['P1', 'P2'] : ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']
}

const REPARTO_PROXIMA = { e: 1.00, p: 0.65 }
const REPARTO_ATULADO = { e: 0.95, p: 0.65 }

function calcComision(kwh: number, kwSum: number, feeE: number, feeP: number, repartoE = 1.0, repartoP = 1.0) {
  const comisionMensual = (feeE * kwh / 12 / 1000 * repartoE) + (feeP * kwSum / 12 * repartoP)
  return { comisionMensual, comisionAnual: comisionMensual * 12 }
}

function calcFija(kwh: number, kwByPeriod: Record<string, number>, kwSum: number, feeE: number, feeP: number, tarifa: Tarifa, mod: 'BOE' | 'WEB', tipo2td: 'DH' | 'Milenial' = 'DH') {
  const r = getAtuladoRate(mod, tarifa, tipo2td)
  const eA = r.e * kwh
  const potP = ATULADO_PERIODOS[mod][tarifa].pot
  let pA = 0
  for (const [p, kw] of Object.entries(kwByPeriod)) {
    pA += (potP[p as keyof PP] ?? 0) * kw
  }
  const feeEA = feeE * kwh / 1000
  const feePA = feeP * kwSum
  const sub = eA + pA + feeEA + feePA
  const iv = getIvaRate(tarifa)
  const { iee, ivaAmt, total } = withImpuestos(sub, iv)
  return {
    eMes: eA / 12, pMes: pA / 12, bonoMes: 0,
    feeEMes: feeEA / 12, feePMes: feePA / 12,
    subtotalMes: sub / 12, ieeMes: iee / 12,
    ivaMes: ivaAmt / 12, totalMes: total / 12, iv,
  }
}

function calcProxima(kwh: number, kwByPeriod: Record<string, number>, kwSum: number, feeE: number, feeP: number, tarifa: Tarifa, periodoKey: PeriodoKey, omieCustom: number) {
  const pc = PROXIMA_CRISTALINA
  const peajesP = PEAJES_POTENCIA_2026[tarifa] as Record<string, number | undefined>
  const cargosP = CARGOS_POTENCIA_2026[tarifa] as Record<string, number | undefined>
  let pA = 0
  for (const [p, kw] of Object.entries(kwByPeriod)) {
    pA += ((peajesP[p] ?? 0) + (cargosP[p] ?? 0)) * kw
  }
  const bonoA = pc.bono_dia * 365
  const feeEA = feeE * kwh / 1000
  const feePA = feeP * kwSum
  const iv = getIvaRate(tarifa)

  let eRate: number
  if (periodoKey === 'custom') {
    const perdAvg = avg(vv(PERD_DEFECTO[tarifa]))
    const peajeEAvg = avg(vv(PEAJES_ENERGIA_2026[tarifa]))
    const cargoEAvg = avg(vv(CARGOS_ENERGIA_2026[tarifa]))
    const mercado = perdAvg * (omieCustom / 1000 + SC_FALLBACK + CAP_2026)
    const feeTot = pc.fee_kwh + pc.fnee_kwh + pc.go_kwh
    eRate = mercado * (1 + pc.tasas_pct) + feeTot + peajeEAvg + cargoEAvg
  } else {
    const precios = vv(PRECIOS_HIST[periodoKey][tarifa])
    eRate = precios.length > 0 ? avg(precios) : avg(vv(PERD_DEFECTO[tarifa])) * (90 / 1000 + SC_FALLBACK + CAP_2026)
  }

  const eA = eRate * kwh
  const sub = eA + pA + bonoA + feeEA + feePA
  const { iee, ivaAmt, total } = withImpuestos(sub, iv)

  return {
    eMes: eA / 12, pMes: pA / 12, bonoMes: bonoA / 12,
    feeEMes: feeEA / 12, feePMes: feePA / 12,
    subtotalMes: sub / 12, ieeMes: iee / 12,
    ivaMes: ivaAmt / 12, totalMes: total / 12, iv,
    eRate,
  }
}

type PriceResult = ReturnType<typeof calcFija>

const ESCENARIOS = [
  { label: 'Fee bajo',  feeE: 2,  feeP: 0.5 },
  { label: 'Fee medio', feeE: 5,  feeP: 1.5 },
  { label: 'Fee alto',  feeE: 10, feeP: 3.0 },
]

// ── sub-componentes ───────────────────────────────────────────────────────────
function TablaPreciosPeriodo({ tarifa, tipo2td, periodoKey, feeE, feeP, labelBoe, labelWeb }: {
  tarifa: Tarifa; tipo2td: 'DH' | 'Milenial'; periodoKey: PeriodoKey
  feeE: number; feeP: number; labelBoe: string; labelWeb: string
}) {
  const [vista, setVista] = useState<'energia' | 'potencia'>('energia')
  const periodos = (tarifa === '2.0TD' ? ['P1', 'P2', 'P3'] : ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) as (keyof PP)[]

  const proxEP  = PRECIOS_HIST[periodoKey][tarifa]
  const boeEP   = getAtuladoPeriodos('BOE', tarifa, tipo2td)
  const webEP   = getAtuladoPeriodos('WEB', tarifa, tipo2td)
  const boePotP = ATULADO_PERIODOS['BOE'][tarifa].pot
  const webPotP = ATULADO_PERIODOS['WEB'][tarifa].pot

  const feeEKwh = feeE / 1000

  return (
    <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1F1F1F] flex items-center justify-between gap-2">
        <div className="flex rounded-lg overflow-hidden border border-[#2A2A2A] text-xs">
          {(['energia', 'potencia'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)}
              className={`px-3 py-1.5 font-medium transition-colors ${
                vista === v ? 'bg-[#00E676]/15 text-[#00E676]' : 'text-[#6B7280] hover:text-white'
              }`}>
              {v === 'energia' ? 'Energía €/kWh' : 'Potencia €/kW·a'}
            </button>
          ))}
        </div>
        <span className="text-[#4B5563] text-xs shrink-0">
          {vista === 'energia' ? `+ ${feeE} €/MWh` : `+ ${feeP} €/kW·a`}
        </span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1F1F1F]">
            <th className="px-3 py-2 text-left text-[#6B7280] font-medium w-10">Per.</th>
            <th className="px-3 py-2 text-right text-amber-400/80 font-medium">Próxima</th>
            <th className="px-3 py-2 text-right text-blue-400/80 font-medium">{labelBoe}</th>
            <th className="px-3 py-2 text-right text-violet-400/80 font-medium">{labelWeb}</th>
          </tr>
        </thead>
        <tbody>
          {periodos.map(p => {
            if (vista === 'energia') {
              const proxV = proxEP[p]
              const boeV  = boeEP[p]
              const webV  = webEP[p]
              return (
                <tr key={p} className="border-b border-[#1A1A1A] last:border-0">
                  <td className="px-3 py-2 text-[#6B7280] font-semibold">{p}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-300/80">
                    {proxV !== undefined ? (proxV + feeEKwh).toFixed(6) : <span className="text-[#374151]">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-blue-300/90 font-medium">
                    {boeV !== undefined ? (boeV + feeEKwh).toFixed(6) : <span className="text-[#374151]">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-violet-300/90 font-medium">
                    {webV !== undefined ? (webV + feeEKwh).toFixed(6) : <span className="text-[#374151]">—</span>}
                  </td>
                </tr>
              )
            } else {
              const proxPeaje = (PEAJES_POTENCIA_2026[tarifa] as Record<string, number | undefined>)[p] ?? 0
              const proxCargo = (CARGOS_POTENCIA_2026[tarifa] as Record<string, number | undefined>)[p] ?? 0
              const proxV = proxPeaje + proxCargo > 0 ? proxPeaje + proxCargo + feeP : undefined
              const boeV  = boePotP[p] !== undefined ? boePotP[p]! + feeP : undefined
              const webV  = webPotP[p] !== undefined ? webPotP[p]! + feeP : undefined
              const cell = (v: number | undefined, color: string, bold?: boolean) =>
                v !== undefined ? (
                  <td className={`px-3 py-1.5 text-right tabular-nums ${color} ${bold ? 'font-medium' : ''}`}>
                    <div>{v.toFixed(4)}</div>
                    <div className="text-[#4B5563] text-[10px]">{(v / 365).toFixed(6)}/d</div>
                  </td>
                ) : <td className="px-3 py-1.5 text-right text-[#374151]">—</td>
              return (
                <tr key={p} className="border-b border-[#1A1A1A] last:border-0">
                  <td className="px-3 py-1.5 text-[#6B7280] font-semibold">{p}</td>
                  {cell(proxV, 'text-amber-300/80')}
                  {cell(boeV,  'text-blue-300/90', true)}
                  {cell(webV,  'text-violet-300/90', true)}
                </tr>
              )
            }
          })}
        </tbody>
      </table>
    </div>
  )
}

function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <label className="text-sm text-[#9CA3AF]">{label}</label>
        <span className="text-white font-semibold text-sm">{value} {unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#00E676]"
        style={{ background: `linear-gradient(to right,#00E676 0%,#00E676 ${((value-min)/(max-min))*100}%,#2A2A2A ${((value-min)/(max-min))*100}%,#2A2A2A 100%)` }}
      />
      <div className="flex justify-between mt-1 text-xs text-[#6B7280]">
        <span>{min} {unit}</span><span>{max} {unit}</span>
      </div>
    </div>
  )
}

function PriceRow({ label, val, green, muted }: { label: string; val: number; green?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={`text-xs ${muted ? 'text-[#4B5563]' : 'text-[#6B7280]'}`}>{label}</span>
      <span className={`text-xs font-medium tabular-nums ${green ? 'text-[#00E676]' : 'text-[#D1D5DB]'}`}>
        {formatCurrency(val)}
      </span>
    </div>
  )
}

function ProductCard({
  name, subtitle, color, border, bg, data, showBono,
}: {
  name: string; subtitle: string; color: string; border: string; bg: string
  data: PriceResult; showBono: boolean
}) {
  return (
    <div className={`bg-[#141414] border ${border} rounded-2xl overflow-hidden flex flex-col`}>
      <div className={`px-4 py-3 ${bg} border-b ${border}`}>
        <p className={`font-bold text-sm ${color}`}>{name}</p>
        <p className="text-[#6B7280] text-xs mt-0.5 truncate">{subtitle}</p>
      </div>
      <div className="px-4 pt-3 pb-4 flex-1 flex flex-col">
        <div className="space-y-0.5 flex-1">
          <PriceRow label="Energía" val={data.eMes} />
          <PriceRow label="Potencia" val={data.pMes} />
          {showBono && data.bonoMes > 0 && <PriceRow label="Bono social" val={data.bonoMes} muted />}
          <div className="border-t border-[#1F1F1F] my-2" />
          <PriceRow label="+ Fee energía" val={data.feeEMes} green />
          <PriceRow label="+ Fee potencia" val={data.feePMes} green />
          <div className="border-t border-[#1F1F1F] my-2" />
          <PriceRow label="Base s/imp." val={data.subtotalMes} />
          <PriceRow label="IEE (0.64%)" val={data.ieeMes} />
          <PriceRow label={`IVA (${(data.iv * 100).toFixed(0)}%)`} val={data.ivaMes} />
        </div>
        <div className="border-t border-[#2A2A2A] mt-3 pt-3 flex items-end justify-between">
          <span className={`text-xs font-bold uppercase tracking-wide ${color}`}>Total/mes</span>
          <span className={`text-xl font-bold tabular-nums ${color}`}>
            {formatCurrency(data.totalMes)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── página ────────────────────────────────────────────────────────────────────
export default function SimuladorPage() {
  const [kwh,        setKwh]        = useState(100000)
  const [kwPeriodos, setKwPeriodos] = useState<Record<string, number>>({ P1: 15, P2: 15, P3: 15, P4: 15, P5: 15, P6: 15 })
  const [feeE,       setFeeE]       = useState(10)
  const [feeP,       setFeeP]       = useState(1.5)
  const [tarifa,     setTarifa]     = useState<Tarifa>('3.0TD')
  const [tipo2td,    setTipo2td]    = useState<'DH' | 'Milenial'>('DH')
  const [periodo,    setPeriodo]    = useState<PeriodoKey>('2026MARZO')
  const [omieCustom, setOmieCustom] = useState(130)

  const kwPNames   = getKwPeriodNames(tarifa)
  const kwByPeriod = Object.fromEntries(kwPNames.map(p => [p, kwPeriodos[p] ?? 15]))
  const kwSum      = kwPNames.reduce((s, p) => s + (kwPeriodos[p] ?? 15), 0)

  const periodoEntry = PRECIOS_HIST[periodo]
  const comision        = calcComision(kwh, kwSum, feeE, feeP, REPARTO_PROXIMA.e, REPARTO_PROXIMA.p)
  const comisionAtulado = calcComision(kwh, kwSum, feeE, feeP, REPARTO_ATULADO.e, REPARTO_ATULADO.p)
  const proxima  = calcProxima(kwh, kwByPeriod, kwSum, feeE, feeP, tarifa, periodo, omieCustom)
  const boe      = calcFija(kwh, kwByPeriod, kwSum, feeE, feeP, tarifa, 'BOE', tipo2td)
  const web      = calcFija(kwh, kwByPeriod, kwSum, feeE, feeP, tarifa, 'WEB', tipo2td)
  const autoMod: 'BOE' | 'WEB' = kwh / Math.max(kwSum, 0.001) > UMBRAL_KWH_POR_KW ? 'WEB' : 'BOE'
  const labelBoe = tarifa === '2.0TD' ? (tipo2td === 'Milenial' ? 'Milenial BOE' : 'DH BOE') : 'Atulado BOE'
  const labelWeb = tarifa === '2.0TD' ? (tipo2td === 'Milenial' ? 'Milenial WEB' : 'DH WEB') : 'Atulado WEB'

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center">
          <Sliders className="w-5 h-5 text-[#00E676]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Simulador de fee</h1>
          <p className="text-[#6B7280] text-sm">Comisión y precio final al cliente — Próxima · Atulado BOE · Atulado WEB</p>
        </div>
      </div>

      {/* ── Inputs + Comisión ────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-5">Datos del cliente</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-2">kWh anuales</label>
                <Input type="number" value={kwh} onChange={(e) => setKwh(Number(e.target.value))} min={1000} step={1000} />
              </div>
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-2">
                  kW contratados por periodo
                </label>
                <div className={`grid gap-2 ${tarifa === '2.0TD' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {kwPNames.map(p => (
                    <div key={p}>
                      <label className="block text-xs text-[#6B7280] mb-1">{p}</label>
                      <Input
                        type="number"
                        value={kwPeriodos[p] ?? 15}
                        onChange={(e) => setKwPeriodos(prev => ({ ...prev, [p]: Number(e.target.value) }))}
                        min={0.1}
                        step={0.1}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[#4B5563] mt-1.5">
                  Total: <span className="text-[#9CA3AF] font-medium">{kwSum.toFixed(1)} kW</span>
                  <span className="ml-2 text-[#3B3B3B]">({kwPNames.map(p => `${p}:${kwPeriodos[p] ?? 15}`).join(' · ')})</span>
                </p>
              </div>
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-2">
                  Mes de referencia <span className="text-[#4B5563]">(Próxima indexada)</span>
                </label>
                <select
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value as PeriodoKey)}
                  className="w-full bg-[#0F0F0F] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50 cursor-pointer"
                >
                  {AÑOS_DISPONIBLES.map(year => (
                    <optgroup key={year} label={String(year)} className="bg-[#141414] text-[#9CA3AF]">
                      {MESES_DISPONIBLES.filter(k => PRECIOS_HIST[k].year === year).map(k => {
                        const e = PRECIOS_HIST[k]
                        const pp = vv(e[tarifa])
                        const hasData = pp.length > 0
                        return (
                          <option key={k} value={k} disabled={!hasData} className="bg-[#141414]">
                            {e.label}{hasData ? ` — ${(avg(pp) * 1000).toFixed(1)} mCt/kWh` : ' — sin datos'}
                          </option>
                        )
                      })}
                    </optgroup>
                  ))}
                  <option value="custom" className="bg-[#141414]">Personalizado (OMIE manual)</option>
                </select>
                {periodo === 'custom' && (
                  <div className="flex items-center gap-2 mt-2">
                    <Input type="number" value={omieCustom} onChange={(e) => setOmieCustom(Number(e.target.value))} min={0} max={500} step={5} className="flex-1" />
                    <span className="text-[#6B7280] text-sm shrink-0">€/MWh</span>
                  </div>
                )}
                {periodo !== 'custom' && (
                  <p className="text-xs text-[#4B5563] mt-1.5">
                    Precio medio {tarifa}:{' '}
                    <span className="text-amber-400/70">
                      {(proxima.eRate * 1000).toFixed(2)} mCt/kWh
                    </span>
                    <span className="ml-1.5">({vv(periodoEntry[tarifa]).length} periodos)</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-3">Tipo de tarifa</label>
                <div className="flex gap-2">
                  {TARIFAS.map(t => (
                    <button
                      key={t}
                      onClick={() => setTarifa(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                        tarifa === t
                          ? 'bg-[#00E676]/10 border-[#00E676]/50 text-[#00E676]'
                          : 'bg-[#0F0F0F] border-[#2A2A2A] text-[#6B7280] hover:border-[#3A3A3A] hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {tarifa === '2.0TD' && (
                <div>
                  <label className="block text-sm text-[#9CA3AF] mb-2">Producto Atulado 2.0TD</label>
                  <div className="flex gap-2">
                    {(['DH', 'Milenial'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setTipo2td(t)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                          tipo2td === t
                            ? 'bg-[#00E676]/10 border-[#00E676]/50 text-[#00E676]'
                            : 'bg-[#0F0F0F] border-[#2A2A2A] text-[#6B7280] hover:border-[#3A3A3A] hover:text-white'
                        }`}
                      >
                        {t === 'DH' ? 'Discriminación hor.' : 'Milenial (precio plano)'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-6">Fee a cobrar</h2>
            <div className="space-y-6">
              <Slider label="Fee energía" value={feeE} min={0} max={30} step={0.5} unit="€/MWh" onChange={setFeeE} />
              <Slider label="Fee potencia" value={feeP} min={0} max={5} step={0.1} unit="€/kW·año" onChange={setFeeP} />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <motion.div
            key={`${feeE}-${feeP}-${kwh}-${kwSum}`}
            initial={{ opacity: 0.6, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-[#141414] border border-[#00E676]/25 rounded-2xl p-6"
          >
            <h2 className="text-white font-semibold mb-4">Tu comisión</h2>
            <div className="grid grid-cols-2 gap-3">
              {/* Próxima — 100% */}
              <div>
                <p className="text-amber-400/70 text-xs font-semibold uppercase tracking-wide mb-2">Próxima <span className="text-[#4B5563] font-normal normal-case">(100%E / 65%P)</span></p>
                <div className="bg-[#0F0F0F] rounded-xl p-3 text-center mb-2">
                  <p className="text-[#6B7280] text-xs mb-0.5">Por mes</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(comision.comisionMensual)}</p>
                </div>
                <div className="bg-[#1a1a0a] border border-amber-500/20 rounded-xl p-3 text-center">
                  <p className="text-[#6B7280] text-xs mb-0.5">Por año</p>
                  <p className="text-xl font-bold text-amber-400">{formatCurrency(comision.comisionAnual)}</p>
                </div>
              </div>
              {/* Atulado — 95%E / 65%P */}
              <div>
                <p className="text-blue-400/70 text-xs font-semibold uppercase tracking-wide mb-2">Atulado <span className="text-[#4B5563] font-normal normal-case">(95%E / 65%P)</span></p>
                <div className="bg-[#0F0F0F] rounded-xl p-3 text-center mb-2">
                  <p className="text-[#6B7280] text-xs mb-0.5">Por mes</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(comisionAtulado.comisionMensual)}</p>
                </div>
                <div className="bg-[#0a0a1a] border border-blue-500/20 rounded-xl p-3 text-center">
                  <p className="text-[#6B7280] text-xs mb-0.5">Por año</p>
                  <p className="text-xl font-bold text-blue-400">{formatCurrency(comisionAtulado.comisionAnual)}</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-[#4B5563] mt-4 text-center">
              {formatNumber(kwh)} kWh/año · {kwSum.toFixed(1)} kW total · {tarifa}
              <span className="mx-1.5">·</span>
              Auto recomendado: <span className={autoMod === 'WEB' ? 'text-violet-400' : 'text-blue-400'}>{autoMod}</span>
              <span className="ml-1">({formatNumber(kwh / Math.max(kwSum, 0.001), 0)} kWh/kW)</span>
            </p>
          </motion.div>

          {/* Mini nota explicativa */}
          <div className="bg-[#0F0F0F] border border-[#1F1F1F] rounded-xl px-4 py-3 text-xs text-[#6B7280] space-y-0.5">
            <p>· Próxima: {periodo === 'custom' ? `estimación OMIE ${omieCustom} €/MWh` : `precios reales ${periodoEntry.label}`}</p>
            <p>· Atulado: tarifas fijas vigentes incluyen peajes + cargos + margen Atulado</p>
            <p>· IEE 0,64% (RDL 7/2026). IVA {tarifa === '2.0TD' ? '10%' : '21%'}. Promedio periodos, sin distribución horaria real.</p>
          </div>

          <TablaPreciosPeriodo
            tarifa={tarifa}
            tipo2td={tipo2td}
            periodoKey={periodo}
            feeE={feeE}
            feeP={feeP}
            labelBoe={labelBoe}
            labelWeb={labelWeb}
          />
        </div>
      </div>

      {/* ── Comparativa 3 productos ──────────────────────────────────────── */}
      <motion.div
        key={`cards-${feeE}-${feeP}-${kwh}-${kwSum}-${tarifa}-${periodo}-${tipo2td}`}
        initial={{ opacity: 0.7 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5"
      >
        <ProductCard
          name="Próxima Cristalina"
          subtitle={periodo === 'custom' ? `Indexada · estimación ${omieCustom} €/MWh` : `Indexada · ${periodoEntry.label}`}
          color="text-amber-400"
          border="border-amber-500/20"
          bg="bg-amber-500/5"
          data={proxima}
          showBono
        />
        <ProductCard
          name={labelBoe}
          subtitle={`Fija · ${(getAtuladoRate('BOE', tarifa, tipo2td).e * 1000).toFixed(1)} mCt/kWh · ${getAtuladoRate('BOE', tarifa, tipo2td).p.toFixed(1)} €/kW·a`}
          color="text-blue-400"
          border="border-blue-500/20"
          bg="bg-blue-500/5"
          data={boe}
          showBono={false}
        />
        <ProductCard
          name={labelWeb}
          subtitle={`Fija · ${(getAtuladoRate('WEB', tarifa, tipo2td).e * 1000).toFixed(1)} mCt/kWh · ${getAtuladoRate('WEB', tarifa, tipo2td).p.toFixed(1)} €/kW·a`}
          color="text-violet-400"
          border="border-violet-500/20"
          bg="bg-violet-500/5"
          data={web}
          showBono={false}
        />
      </motion.div>

      {/* ── Tabla de escenarios ──────────────────────────────────────────── */}
      <div className="mt-5 bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1F1F1F]">
          <h2 className="text-white font-semibold">Tabla de escenarios</h2>
          <p className="text-[#6B7280] text-xs mt-0.5">
            {formatNumber(kwh)} kWh/año · {kwSum.toFixed(1)} kW total · {tarifa}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1F1F1F]">
                {['Escenario','Fee E','Fee P','Com. Próxima/año','Com. Atulado/año','Próxima/mes',`${labelBoe}/mes`,`${labelWeb}/mes`].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ESCENARIOS.map((s) => {
                const r  = calcComision(kwh, kwSum, s.feeE, s.feeP, REPARTO_PROXIMA.e, REPARTO_PROXIMA.p)
                const rA = calcComision(kwh, kwSum, s.feeE, s.feeP, REPARTO_ATULADO.e, REPARTO_ATULADO.p)
                const px = calcProxima(kwh, kwByPeriod, kwSum, s.feeE, s.feeP, tarifa, periodo, omieCustom)
                const b  = calcFija(kwh, kwByPeriod, kwSum, s.feeE, s.feeP, tarifa, 'BOE', tipo2td)
                const w  = calcFija(kwh, kwByPeriod, kwSum, s.feeE, s.feeP, tarifa, 'WEB', tipo2td)
                const active = s.feeE === feeE && s.feeP === feeP
                return (
                  <tr
                    key={s.label}
                    className={`border-b border-[#1F1F1F] last:border-0 transition-colors ${active ? 'bg-[#00E676]/5' : 'hover:bg-[#1A1A1A]'}`}
                  >
                    <td className="px-3 py-3">
                      <span className={`font-medium ${active ? 'text-[#00E676]' : 'text-white'}`}>{s.label}</span>
                      {active && <span className="ml-1.5 text-xs text-[#00E676]">←</span>}
                    </td>
                    <td className="px-3 py-3 text-[#9CA3AF] text-xs whitespace-nowrap">{s.feeE} €/MWh</td>
                    <td className="px-3 py-3 text-[#9CA3AF] text-xs whitespace-nowrap">{s.feeP} €/kW·a</td>
                    <td className="px-3 py-3 font-bold text-amber-400 tabular-nums">{formatCurrency(r.comisionAnual)}</td>
                    <td className="px-3 py-3 font-bold text-blue-400 tabular-nums">{formatCurrency(rA.comisionAnual)}</td>
                    <td className="px-3 py-3 font-semibold text-amber-400 tabular-nums">{formatCurrency(px.totalMes)}</td>
                    <td className="px-3 py-3 font-semibold text-blue-400 tabular-nums">{formatCurrency(b.totalMes)}</td>
                    <td className="px-3 py-3 font-semibold text-violet-400 tabular-nums">{formatCurrency(w.totalMes)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
