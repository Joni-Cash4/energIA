import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const PROMPT = `Eres un experto en facturas eléctricas españolas. Analiza esta factura (puede ser una foto o PDF escaneado) y extrae los datos con máxima precisión.

INSTRUCCIONES IMPORTANTES:
- El CUPS empieza siempre por "ES" y tiene 20-22 caracteres. Búscalo en "Código unificado de punto de suministro" o "CUPS".
- La tarifa puede ser 2.0TD, 3.0TD, 6.1TD, etc. Búscala en "Peaje de acceso" o "Tarifa".
- Para facturas 3.0TD: solo tienen consumo en los periodos activos de esa temporada. Los periodos con 0 kWh NO los incluyas en el array de periodos.
- El precio €/kWh de cada periodo es la SUMA de: peaje de acceso + cargos del sistema + coste de energía. Súmalos si aparecen desglosados.
- El importe de cada periodo es la suma total de ese periodo (peaje + cargos + energía).
- kwh_total es la suma de kWh de todos los periodos.
- potencia_contratada: usa el valor de P1 en kW.
- total_factura: el importe final total incluyendo IVA.

Devuelve este JSON exacto:
{
  "cups": "string",
  "comercializadora": "string",
  "tarifa": "string",
  "fecha_inicio": "YYYY-MM-DD",
  "fecha_fin": "YYYY-MM-DD",
  "total_factura": number,
  "kwh_total": number,
  "potencia_contratada": number,
  "periodos": [
    {
      "periodo": "P1" | "P2" | "P3" | "P4" | "P5" | "P6",
      "kwh": number,
      "precio_kwh": number,
      "importe": number
    }
  ]
}

Responde ÚNICAMENTE con el JSON, sin texto adicional ni bloques de código markdown.
Si un campo no aparece claramente en la factura, usa null.`

function buildSavingsEstimate(data: {
  kwh_total: number
  total_factura: number
  periodos: { periodo: string; kwh: number; precio_kwh: number; importe: number }[]
}) {
  const savingsPct = 0.18
  const coste_actual_energia = data.periodos?.reduce((s, p) => s + (p.importe ?? 0), 0) ?? data.total_factura * 0.65
  const coste_actual_potencia = data.total_factura - coste_actual_energia
  const coste_nuevo_energia = Math.round(coste_actual_energia * (1 - savingsPct) * 100) / 100
  const coste_nuevo_potencia = Math.round(coste_actual_potencia * 0.95 * 100) / 100
  const ahorro_mensual = Math.round((coste_actual_energia - coste_nuevo_energia) * 100) / 100

  return {
    coste_actual_energia: Math.round(coste_actual_energia * 100) / 100,
    coste_nuevo_energia,
    coste_actual_potencia: Math.round(coste_actual_potencia * 100) / 100,
    coste_nuevo_potencia,
    ahorro_estimado_mensual: ahorro_mensual,
    ahorro_estimado_anual: Math.round(ahorro_mensual * 12 * 100) / 100,
    porcentaje_ahorro: Math.round(savingsPct * 100),
    kwh_anuales_sips: Math.round((data.kwh_total ?? 0) * 12),
    periodos: (data.periodos ?? []).map((p) => ({
      ...p,
      kwh_nuevo: p.kwh,
      precio_kwh_nuevo: Math.round(p.precio_kwh * (1 - savingsPct) * 10000) / 10000,
      importe_nuevo: Math.round(p.importe * (1 - savingsPct) * 100) / 100,
    })),
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

  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  const client = new Anthropic({ apiKey })

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
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
    const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(json)

    const savings = buildSavingsEstimate(parsed)
    return NextResponse.json({ ...parsed, ...savings })
  } catch (err) {
    console.error('[process-invoice]', err)
    return NextResponse.json({ error: 'Error al analizar la factura con IA' }, { status: 500 })
  }
}
