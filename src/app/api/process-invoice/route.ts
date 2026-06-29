import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  PEAJES_ENERGIA_2026,
  CARGOS_ENERGIA_2026,
  PEAJES_POTENCIA_2026,
  CARGOS_POTENCIA_2026,
  PROXIMA_CRISTALINA,
  ATULADO_BOE,
  ATULADO_WEB,
  PERIODOS_TARIFA,
  UMBRAL_KWH_POR_KW,
  normalizaTarifa,
  type Periodo,
  type Tarifa,
} from '@/lib/market-rates'
import { getMercadoReal } from '@/lib/market-real'
import { getZonaFromCups } from '@/lib/periodos'
import type { SimTarifa } from '@/types'

const SYSTEM_PROMPT = `Eres un extractor de datos de facturas eléctricas españolas. Tu única función es devolver un JSON válido con los datos extraídos. NUNCA expliques tu razonamiento, NUNCA escribas texto fuera del JSON, NUNCA uses markdown. Solo JSON.`

const PROMPT = `Analiza esta factura eléctrica y devuelve ÚNICAMENTE el JSON especificado a continuación. Sin texto previo, sin explicaciones, sin markdown. SOLO el JSON.

PASO 1 — TIPO DE FACTURA:
Si el documento NO es una factura de ELECTRICIDAD (puede ser gas natural, agua, internet, teléfono u otro suministro), devuelve ÚNICAMENTE este JSON y nada más:
{"error": "no_electrica", "tipo": "gas" | "agua" | "internet" | "otro"}

Solo si es una factura eléctrica, continúa con el PASO 2.

PASO 2 — EXTRACCIÓN DE DATOS. Extrae los datos con máxima precisión.

INSTRUCCIONES IMPORTANTES:
- El CUPS empieza siempre por "ES" y tiene 20-22 caracteres.
- La tarifa puede ser 2.0TD, 3.0TD, 6.1TD, etc.
- Para facturas 3.0TD: solo incluye los periodos con kWh > 0. Los periodos con 0 kWh NO los incluyas.
- precio_kwh de cada periodo = peaje_kwh + cargos_kwh + mercado_kwh (suma de los tres componentes), el precio total que paga el cliente por esa energía.
- mercado_kwh = precio del "coste de la energía" o "precio indexado" por kWh de ese periodo (solo el componente de mercado OMIE/pool, sin peajes ni cargos). Busca "Importe por coste de la energía", "Energía. Mercado" o similar.
- importe de cada periodo = suma de (peaje + cargos + energía) × kWh de ese periodo (solo energía, sin potencia ni impuestos).
- kwh_total = suma de kWh de todos los periodos con consumo.
- potencia_contratada = valor en kW de P1 (solo para mostrar, no se usa para calcular).
- potencias = un array con la potencia contratada en kW de CADA periodo tarifario (P1 a P6 para 3.0TD/6.1TD, P1 a P3 para 2.0TD), AUNQUE NO TENGAN CONSUMO DE ENERGÍA. IMPORTANTE: la potencia contratada NO siempre es igual en todos los periodos (ej: P1=30kW, P2-P5=35kW, P6=60kW es habitual en 3.0TD). Busca la tabla "Potencia contratada" o "Potencia facturada" por periodo y extrae el valor exacto de cada uno, no asumas que son iguales.
- dias_facturados = número de días del periodo de facturación (fecha_fin - fecha_inicio).
- dias_facturados_potencia = días de potencia facturada. Busca "Término Potencia" y lee cuántos días pone (ej: "30 Días"). Si coincide con dias_facturados, usa el mismo valor. Si no aparece, usa dias_facturados.
- potencia_total = importe total facturado por potencia, SUMANDO TODAS las secciones relacionadas con potencia que aparezcan en el detalle de la factura, antes de IEE e IVA. ALGUNAS FACTURAS DESGLOSAN LA POTENCIA EN VARIAS SECCIONES SEPARADAS (ej: "Término Potencia Tarifa Acceso", "Término Potencia" propio de la comercializadora, "Término Cargos Potencia Acceso") — debes sumar el importe de TODAS ellas, no solo una. Incluye también excesos de potencia si existen.
- reactiva_total = importe total de energía reactiva + excesos de energía reactiva (si existe, sino 0).
- alquiler_equipos = importe del alquiler de equipos de medida y control (antes de IVA).
- productos_total = suma de cualquier concepto adicional que NO sea energía/potencia/reactiva/alquiler/impuestos — por ejemplo "Regularización Servicios de Ajuste del Sistema", penalizaciones, cargos extraordinarios, ajustes de periodos anteriores, etc. Si no hay ninguno, usa 0. Estos conceptos son específicos de la comercializadora actual y NO se trasladan a una simulación con otra tarifa.
- importe_iee = importe en euros del Impuesto Especial sobre la Electricidad (busca "Impuesto Electricidad", "IEE" o similar).
- base_imponible = base imponible antes de IVA (busca "Base imponible").
- importe_iva = importe en euros del IVA aplicado.
- total_factura = importe final total incluyendo IVA.

Devuelve EXACTAMENTE este JSON (sin texto antes ni después):
{
  "cups": "string",
  "comercializadora": "string",
  "tarifa": "string",
  "fecha_inicio": "YYYY-MM-DD",
  "fecha_fin": "YYYY-MM-DD",
  "total_factura": number,
  "kwh_total": number,
  "potencia_contratada": number,
  "potencias": [ { "periodo": "P1" | "P2" | "P3" | "P4" | "P5" | "P6", "kw": number } ],
  "dias_facturados": number,
  "dias_facturados_potencia": number,
  "potencia_total": number,
  "reactiva_total": number,
  "alquiler_equipos": number,
  "productos_total": number,
  "importe_iee": number,
  "base_imponible": number,
  "importe_iva": number,
  "periodos": [
    {
      "periodo": "P1" | "P2" | "P3" | "P4" | "P5" | "P6",
      "kwh": number,
      "precio_kwh": number,
      "mercado_kwh": number,
      "importe": number
    }
  ]
}

Responde ÚNICAMENTE con el JSON, sin texto adicional ni bloques de código markdown.
Si un campo no aparece claramente, usa null.`

const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'application/pdf',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
}

const r2 = (n: number) => Math.round(n * 100) / 100
const r4 = (n: number) => Math.round(n * 10000) / 10000

type Periodos = Partial<Record<Periodo, number>>

type InvoiceData = {
  cups?: string | null
  tarifa: string
  fecha_inicio: string
  fecha_fin: string
  kwh_total: number
  total_factura: number
  potencia_contratada: number
  potencias?: { periodo: string; kw: number }[]
  dias_facturados: number
  dias_facturados_potencia?: number
  potencia_total?: number
  reactiva_total?: number
  alquiler_equipos?: number
  productos_total?: number
  importe_iee?: number
  base_imponible?: number
  importe_iva?: number
  periodos: { periodo: string; kwh: number; precio_kwh: number; mercado_kwh?: number; importe: number }[]
}

// Devuelve un mapa periodo->kW. Si la factura no trae potencias[] desglosadas
// (formato antiguo o extracción incompleta), usa potencia_contratada uniforme
// como fallback — pero esto introduce error en clientes con potencia no uniforme.
function potenciaPorPeriodo(data: InvoiceData, tarifa: Tarifa): Periodos {
  const mapa: Periodos = {}
  if (data.potencias && data.potencias.length > 0) {
    for (const p of data.potencias) {
      mapa[p.periodo as Periodo] = p.kw
    }
    return mapa
  }
  // Fallback: uniforme (impreciso si la potencia real varía por periodo)
  const kw = data.potencia_contratada ?? 0
  for (const p of PERIODOS_TARIFA[tarifa]) mapa[p] = kw
  return mapa
}

// Histórico PMD real para el periodo exacto de la factura — NO el precio de hoy
async function fetchHistoricalPmd(
  start: string, end: string, tarifa: Tarifa, zona: string
): Promise<{ pmd: Periodos; media: number; ok: boolean }> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('http')
      ? process.env.NEXT_PUBLIC_SITE_URL
      : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
    const res = await fetch(
      `${base}/api/market-historical?start=${start}&end=${end}&tarifa=${tarifa}&zona=${zona}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return { pmd: {}, media: 0, ok: false }
    const json = await res.json()
    if (json._fallback || !json.pmd_por_periodo_mwh) return { pmd: {}, media: 0, ok: false }
    return { pmd: json.pmd_por_periodo_mwh, media: json.media_mwh ?? 0, ok: true }
  } catch {
    return { pmd: {}, media: 0, ok: false }
  }
}

function mesKey(fecha: string): string {
  return fecha.slice(0, 7) // YYYY-MM
}

// ── Simulación Próxima Cristalina (indexada) ──────────────────────────────────
// precio_proxima_kwh = PEAJ_BOE + CARG_BOE + PERD×(PMD_histórico + SC + CAP) + fee
// sc, cap y perd vienen de getMercadoReal(): Supabase (real, sync mensual) > hardcoded > fallback
function simIndexada(
  data: InvoiceData, tarifa: Tarifa, pmdHistorico: Periodos, sc: number, cap: number,
  perd: Periodos, tipoIee: number, tipoIva: number, feeKwh: number, potenciaKw: Periodos
): SimTarifa {
  const periodos = PERIODOS_TARIFA[tarifa]
  const dias = data.dias_facturados || 30
  const diasPotencia = data.dias_facturados_potencia ?? dias
  const reactiva = r2(data.reactiva_total ?? 0)
  const alquiler = r2(data.alquiler_equipos ?? 0)

  let energiaTotal = 0
  let mercadoPuroTotal = 0
  let kwhTotal = 0
  for (const linea of data.periodos ?? []) {
    const p = linea.periodo as Periodo
    const kwh = linea.kwh ?? 0
    if (kwh <= 0) continue
    const peaje = PEAJES_ENERGIA_2026[tarifa][p] ?? 0
    const cargo = CARGOS_ENERGIA_2026[tarifa][p] ?? 0
    const perdP = perd[p] ?? 1.06
    const pmdKwh = (pmdHistorico[p] ?? 0) / 1000 // €/MWh -> €/kWh
    const mercado = perdP * (pmdKwh + sc + cap)
    const precio = peaje + cargo + mercado + feeKwh
    energiaTotal += precio * kwh
    mercadoPuroTotal += mercado * kwh
    kwhTotal += kwh
  }
  energiaTotal = r2(energiaTotal)

  // Otros costes Próxima: FNEE + GO + bono social + tasas 1.5% sobre mercado+fee
  const fnee = kwhTotal * PROXIMA_CRISTALINA.fnee_kwh
  const go = kwhTotal * PROXIMA_CRISTALINA.go_kwh
  const bono = dias * PROXIMA_CRISTALINA.bono_dia
  const feeTotal = kwhTotal * feeKwh
  const tasas = (mercadoPuroTotal + feeTotal) * PROXIMA_CRISTALINA.tasas_pct
  const otrosCostes = r2(fnee + go + bono + tasas)
  const cargoGestion = r2(feeTotal)

  // Potencia: solo peajes+cargos BOE, sin margen propio (igual que factura real Próxima)
  // Usa el kW REAL de cada periodo — no siempre es uniforme (ej. P1=30kW, P6=60kW)
  const potencia_periodos_idx: Partial<Record<string, number>> = {}
  for (const p of periodos) {
    const kw = potenciaKw[p] ?? 0
    const pj = PEAJES_POTENCIA_2026[tarifa][p] ?? 0
    const cg = CARGOS_POTENCIA_2026[tarifa][p] ?? 0
    potencia_periodos_idx[p] = r2(kw * diasPotencia * (pj + cg) / 365)
  }
  const potencia = r2(Object.values(potencia_periodos_idx).reduce<number>((s, v) => s + (v ?? 0), 0))

  // IEE: tipo efectivo derivado de la factura real × base monetaria de esta simulación.
  // Si la factura usa 1.0€/MWh (RDL 7/2026), el tipo efectivo (~0.64%) aplicado a bases
  // similares da un resultado muy próximo. Si vuelve al 5.1127%, se aplica automáticamente.
  const subtotalBase = r2(energiaTotal + potencia + reactiva + otrosCostes)
  const iee = r2(subtotalBase * tipoIee)
  const subtotal = r2(subtotalBase + alquiler)
  const base_iva = r2(subtotal + iee)
  const iva = r2(base_iva * tipoIva)
  const total = r2(base_iva + iva)

  return {
    energia: energiaTotal, potencia, potencia_periodos: potencia_periodos_idx,
    reactiva, otros_costes: otrosCostes,
    cargo_gestion: cargoGestion, subtotal, iee, alquiler, base_iva, iva,
    iva_pct: tipoIva, total,
  }
}

// ── Simulación Atulado (BOE o WEB) — precio fijo ──────────────────────────────
function simFija(
  data: InvoiceData, tarifa: Tarifa, producto: typeof ATULADO_BOE,
  tipoIee: number, tipoIva: number, potenciaKw: Periodos
): SimTarifa {
  const dias = data.dias_facturados || 30
  const diasPotencia = data.dias_facturados_potencia ?? dias
  const reactiva = r2(data.reactiva_total ?? 0)
  const alquiler = r2(data.alquiler_equipos ?? 0)

  const preciosEnergia = producto.energia[tarifa] ?? {}
  const preciosPotencia = producto.potencia[tarifa] ?? {}

  let energia = 0
  for (const linea of data.periodos ?? []) {
    const p = linea.periodo as Periodo
    const kwh = linea.kwh ?? 0
    if (kwh <= 0) continue
    energia += kwh * (preciosEnergia[p] ?? 0)
  }
  energia = r2(energia)

  const potencia_periodos_fija: Partial<Record<string, number>> = {}
  for (const p of PERIODOS_TARIFA[tarifa]) {
    const kw = potenciaKw[p] ?? 0
    potencia_periodos_fija[p] = r2(kw * diasPotencia * (preciosPotencia[p] ?? 0))
  }
  const potencia = r2(Object.values(potencia_periodos_fija).reduce<number>((s, v) => s + (v ?? 0), 0))

  // IEE: tipo efectivo derivado de la factura real × base de esta simulación
  const subtotalBase = r2(energia + potencia + reactiva)
  const iee = r2(subtotalBase * tipoIee)
  const subtotal = r2(subtotalBase + alquiler)
  const base_iva = r2(subtotal + iee)
  const iva = r2(base_iva * tipoIva)
  const total = r2(base_iva + iva)

  return {
    energia, potencia, potencia_periodos: potencia_periodos_fija,
    reactiva, otros_costes: 0, cargo_gestion: 0,
    subtotal, iee, alquiler, base_iva, iva, iva_pct: tipoIva, total,
    nota: producto.nombre,
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const form = await req.formData()
  const allEntries = form.getAll('files')
  const files = allEntries.filter((f): f is File => f instanceof File && !!ALLOWED_MIME[f.type])

  if (files.length === 0) {
    return NextResponse.json(
      { error: 'Sube al menos un archivo PDF o imagen (JPG, PNG, WEBP)' },
      { status: 400 }
    )
  }

  const fileBlocks = await Promise.all(
    files.map(async (file) => {
      const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
      const mime = ALLOWED_MIME[file.type]
      if (mime === 'application/pdf') {
        return {
          type: 'document' as const,
          source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
        }
      }
      return {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: mime as 'image/jpeg' | 'image/png' | 'image/webp',
          data: base64,
        },
      }
    })
  )

  const client = new Anthropic({ apiKey })

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [...fileBlocks, { type: 'text', text: PROMPT }] }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(json) as InvoiceData & { error?: string; tipo?: string }

    if (parsed.error === 'no_electrica') {
      const tipo = parsed.tipo ?? 'otro'
      const msg =
        tipo === 'gas'
          ? 'Esto es una factura de gas natural. Necesitamos tu factura de electricidad para hacer la comparativa.'
          : tipo === 'agua'
            ? 'Esto es una factura de agua. Necesitamos tu factura de electricidad.'
            : tipo === 'internet'
              ? 'Esto es una factura de internet/teléfono. Necesitamos tu factura de electricidad.'
              : 'Este documento no parece ser una factura eléctrica. Sube una foto o PDF de tu factura de la luz.'
      return NextResponse.json({ error: msg, tipo }, { status: 422 })
    }

    const tarifa = normalizaTarifa(parsed.tarifa)
    // Zona detectada desde CUPS — determina temporadas y horas punta correctas
    const zona = getZonaFromCups(parsed.cups)

    // Histórico PMD del periodo exacto de la factura (no precio de hoy)
    const { pmd: pmdHistorico, media: pmdMedia, ok: histOk } = await fetchHistoricalPmd(
      parsed.fecha_inicio, parsed.fecha_fin, tarifa, zona
    )
    const mes = mesKey(parsed.fecha_inicio)
    // sc/cap/perd: Supabase (real, sync mensual desde sistema Python) > hardcoded > fallback
    const mercadoReal = await getMercadoReal(mes, tarifa)
    const { sc, cap, perd } = mercadoReal

    // Impuestos derivados de la PROPIA factura — no hardcodeados.
    // Esto adapta automáticamente a 2.0TD/3.0TD, IEE/IVA reducidos por RDL 17/2021, etc.
    // Nota: el alquiler de contador NO suele entrar en la base del IEE (es un servicio,
    // no consumo eléctrico) — se resta para no inflar el tipo efectivo derivado.
    const importeIee = r2(parsed.importe_iee ?? 0)
    const baseImponible = parsed.base_imponible ?? 0
    const importeIva = parsed.importe_iva ?? 0
    // tipoIee: tipo efectivo de la factura real — auto-adaptativo a cualquier régimen regulatorio.
    // Con RDL 7/2026 (1.0€/MWh mínimo): ~0.64%. Si vuelve al 5.1127%: ~5.1127%. Sin hardcodear.
    const alquilerParaIee = parsed.alquiler_equipos ?? 0
    const subtotalReal = baseImponible - importeIee - alquilerParaIee
    const tipoIee = subtotalReal > 0 ? importeIee / subtotalReal : 0.005
    const tipoIva = baseImponible > 0 ? importeIva / baseImponible : 0.21

    const potenciaKw = potenciaPorPeriodo(parsed, tarifa)
    const potenciasDesglosadas = !!parsed.potencias && parsed.potencias.length > 0

    const feeKwh = 0 // fee Jonathan se aplica en dashboard, no en esta llamada base
    const sim_indexada = simIndexada(parsed, tarifa, pmdHistorico, sc, cap, perd, tipoIee, tipoIva, feeKwh, potenciaKw)

    // Selección automática Atulado BOE vs WEB según ratio kWh/kW·mes
    // Normalizar a 30 días para que facturas largas (ej: 242 días) no inflén el ratio.
    const kwhTotal = parsed.kwh_total ?? 0
    const dias = parsed.dias_facturados || 30
    const kw = parsed.potencia_contratada ?? 1
    const kwhMensualEq = dias > 0 ? kwhTotal * 30 / dias : kwhTotal
    const ratio = kw > 0 ? kwhMensualEq / kw : 0
    const recomendado = ratio > UMBRAL_KWH_POR_KW ? 'WEB' : 'BOE'

    const sim_fija_boe = simFija(parsed, tarifa, ATULADO_BOE, tipoIee, tipoIva, potenciaKw)
    const sim_fija_web = simFija(parsed, tarifa, ATULADO_WEB, tipoIee, tipoIva, potenciaKw)

    const ahorro_mensual = r2((parsed.total_factura ?? 0) - sim_indexada.total)

    // Precio indexado por periodo (para tabla de detalle en dashboard/PDF)
    const periodos = (parsed.periodos ?? []).map((p) => {
      const periodo = p.periodo as Periodo
      const peaje = PEAJES_ENERGIA_2026[tarifa][periodo] ?? 0
      const cargo = CARGOS_ENERGIA_2026[tarifa][periodo] ?? 0
      const perdP = perd[periodo] ?? 1.06
      const pmdKwh = (pmdHistorico[periodo] ?? 0) / 1000
      const mercado = perdP * (pmdKwh + sc + cap)
      const precioNuevo = r4(peaje + cargo + mercado + feeKwh)
      return {
        ...p,
        kwh_nuevo: p.kwh,
        precio_kwh_nuevo: precioNuevo,
        importe_nuevo: r2(precioNuevo * (p.kwh ?? 0)),
      }
    })

    return NextResponse.json({
      ...parsed,
      periodos,
      coste_actual_energia: r2(periodos.reduce((s, p) => s + (p.importe ?? 0), 0)),
      coste_nuevo_energia: r2(periodos.reduce((s, p) => s + (p.importe_nuevo ?? 0), 0)),
      coste_actual_potencia: r2((parsed.potencia_total ?? 0) + (parsed.reactiva_total ?? 0)),
      coste_nuevo_potencia: r2(sim_indexada.potencia + sim_indexada.reactiva),
      ahorro_estimado_mensual: ahorro_mensual,
      ahorro_estimado_anual: r2(ahorro_mensual * 12),
      porcentaje_ahorro: parsed.total_factura > 0
        ? Math.round((ahorro_mensual / parsed.total_factura) * 100)
        : 0,
      kwh_anuales_sips: Math.round((parsed.kwh_total ?? 0) / dias * 365),
      mercado_actual_mwh: Math.round(pmdMedia * 10) / 10,
      mercado_historico_ok: histOk,
      mercado_real_fuente: mercadoReal.fuente,
      potencias_desglosadas: potenciasDesglosadas,
      potencia_total: r2(parsed.potencia_total ?? 0),
      reactiva_total: r2(parsed.reactiva_total ?? 0),
      alquiler_equipos: r2(parsed.alquiler_equipos ?? 0),
      total_nuevo_estimado: sim_indexada.total,
      tipo_iee_detectado: r4(tipoIee),
      tipo_iva_detectado: r4(tipoIva),
      zona_detectada: zona,
      atulado_recomendado: recomendado,
      sim_indexada,
      sim_fija_boe,
      sim_fija_web,
    })
  } catch (err) {
    console.error('[process-invoice]', err)
    return NextResponse.json({ error: 'Error al analizar la factura con IA' }, { status: 500 })
  }
}
