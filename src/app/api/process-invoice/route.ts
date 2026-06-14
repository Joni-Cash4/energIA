import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const PROMPT = `Eres un experto en facturas eléctricas españolas. Analiza esta factura y extrae los datos en JSON con exactamente esta estructura:

{
  "cups": "string — código CUPS (ES...)",
  "comercializadora": "string — nombre de la comercializadora",
  "tarifa": "string — 2.0TD, 3.0TD, etc.",
  "fecha_inicio": "YYYY-MM-DD",
  "fecha_fin": "YYYY-MM-DD",
  "total_factura": number — importe total en euros,
  "kwh_total": number — kWh consumidos en el periodo,
  "potencia_contratada": number — kW,
  "periodos": [
    {
      "periodo": "P1" | "P2" | "P3" | "P4" | "P5" | "P6",
      "kwh": number,
      "precio_kwh": number — precio en €/kWh,
      "importe": number — importe en euros
    }
  ]
}

Responde ÚNICAMENTE con el JSON, sin texto adicional ni bloques de código markdown.
Si un campo no aparece en la factura, usa null.`

function buildSavingsEstimate(data: {
  kwh_total: number
  potencia_contratada: number
  total_factura: number
  periodos: { periodo: string; kwh: number; precio_kwh: number; importe: number }[]
}) {
  // Estimate savings switching to indexed tariff (approx 15-25% on energy)
  const savingsPct = 0.18
  const coste_actual_energia = data.periodos?.reduce((s: number, p: { importe: number }) => s + (p.importe ?? 0), 0) ?? data.total_factura * 0.65
  const coste_actual_potencia = data.total_factura - coste_actual_energia
  const coste_nuevo_energia = Math.round(coste_actual_energia * (1 - savingsPct) * 100) / 100
  const coste_nuevo_potencia = Math.round(coste_actual_potencia * 0.95 * 100) / 100
  const ahorro_mensual = Math.round((coste_actual_energia - coste_nuevo_energia) * 100) / 100
  const ahorro_anual = Math.round(ahorro_mensual * 12 * 100) / 100

  const periodsWithNew = (data.periodos ?? []).map((p: { periodo: string; kwh: number; precio_kwh: number; importe: number }) => ({
    ...p,
    kwh_nuevo: p.kwh,
    precio_kwh_nuevo: Math.round(p.precio_kwh * (1 - savingsPct) * 10000) / 10000,
    importe_nuevo: Math.round(p.importe * (1 - savingsPct) * 100) / 100,
  }))

  return {
    coste_actual_energia: Math.round(coste_actual_energia * 100) / 100,
    coste_nuevo_energia,
    coste_actual_potencia: Math.round(coste_actual_potencia * 100) / 100,
    coste_nuevo_potencia,
    ahorro_estimado_mensual: ahorro_mensual,
    ahorro_estimado_anual: ahorro_anual,
    porcentaje_ahorro: Math.round(savingsPct * 100),
    kwh_anuales_sips: Math.round((data.kwh_total ?? 0) * 12),
    periodos: periodsWithNew,
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Se requiere un archivo PDF' }, { status: 400 })
  }

  // Convert PDF to base64
  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  const client = new Anthropic({ apiKey })

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    // Strip markdown code fences if present
    const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(json)

    const savings = buildSavingsEstimate(parsed)
    return NextResponse.json({ ...parsed, ...savings })
  } catch (err) {
    console.error('[process-invoice]', err)
    return NextResponse.json({ error: 'Error al analizar la factura con IA' }, { status: 500 })
  }
}
