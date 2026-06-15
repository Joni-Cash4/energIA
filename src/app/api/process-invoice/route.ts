import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const PROMPT = `Eres un experto en facturas eléctricas españolas. Analiza esta factura (puede ser foto o PDF escaneado, en una o varias imágenes) y extrae los datos con máxima precisión.

INSTRUCCIONES IMPORTANTES:
- El CUPS empieza siempre por "ES" y tiene 20-22 caracteres.
- La tarifa puede ser 2.0TD, 3.0TD, 6.1TD, etc.
- Para facturas 3.0TD: solo incluye los periodos con kWh > 0. Los periodos con 0 kWh NO los incluyas.
- precio_kwh de cada periodo = peaje_kwh + cargos_kwh + mercado_kwh (suma de los tres componentes).
- mercado_kwh = precio del "coste de la energía" o "precio indexado" por kWh de ese periodo (solo el componente de mercado OMIE, sin peajes ni cargos). Busca "Importe por coste de la energía" o "Precio indexado" en el detalle.
- peaje_kwh = precio del peaje de acceso por kWh de ese periodo.
- cargos_kwh = precio de los cargos del sistema por kWh de ese periodo.
- importe de cada periodo = suma de (peaje + cargos + energía) × kWh de ese periodo (solo energía, sin potencia ni impuestos).
- kwh_total = suma de kWh de todos los periodos con consumo.
- potencia_contratada = valor en kW de P1.
- total_factura = importe final total incluyendo IVA.

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

async function fetchMarketAvgMwh(): Promise<number> {
  try {
    const now = new Date()
    const isDST = (d: Date) => {
      const jan = new Date(d.getFullYear(), 0, 1).getTimezoneOffset()
      const jul = new Date(d.getFullYear(), 6, 1).getTimezoneOffset()
      return d.getTimezoneOffset() < Math.max(jan, jul)
    }
    const spainOffset = isDST(now) ? 2 : 1
    const spainTime = new Date(now.getTime() + spainOffset * 3600 * 1000)
    const dateStr = spainTime.toISOString().split('T')[0]

    const res = await fetch(
      `https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?time_trunc=hour&start_date=${dateStr}T00:00&end_date=${dateStr}T23:59&geo_trunc=electric_system&geo_limit=peninsular&geo_ids=8741`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 3600 } }
    )
    if (!res.ok) return 120
    const json = await res.json()
    const values: { value: number }[] = json?.included?.[0]?.attributes?.values ?? []
    if (values.length === 0) return 120
    return values.reduce((s, v) => s + v.value, 0) / values.length
  } catch {
    return 120
  }
}

function buildSavingsEstimate(
  data: {
    kwh_total: number
    total_factura: number
    potencia_contratada: number
    periodos: { periodo: string; kwh: number; precio_kwh: number; mercado_kwh?: number; importe: number }[]
  },
  marketAvgMwh: number
) {
  const marketAvgKwh = marketAvgMwh / 1000

  const periodos = (data.periodos ?? []).map((p) => {
    // Regulated component = precio_kwh - mercado_kwh (peajes + cargos from invoice)
    const mercadoKwh = p.mercado_kwh ?? p.precio_kwh * 0.6
    const reguladoKwh = p.precio_kwh - mercadoKwh

    // New price = same regulated + today's market
    const newPrecioKwh = Math.round((reguladoKwh + marketAvgKwh) * 10000) / 10000
    const newImporte = Math.round(newPrecioKwh * (p.kwh ?? 0) * 100) / 100

    return {
      ...p,
      kwh_nuevo: p.kwh,
      precio_kwh_nuevo: newPrecioKwh,
      importe_nuevo: newImporte,
    }
  })

  const coste_actual_energia = periodos.reduce((s, p) => s + (p.importe ?? 0), 0)
  const coste_nuevo_energia = periodos.reduce((s, p) => s + p.importe_nuevo, 0)
  const ahorro_mensual = Math.round((coste_actual_energia - coste_nuevo_energia) * 100) / 100

  // Potencia cost = total - energia (approximation, includes taxes/meter)
  const coste_actual_potencia = Math.max(0, (data.total_factura ?? 0) - coste_actual_energia)
  const coste_nuevo_potencia = Math.round(coste_actual_potencia * 100) / 100

  const porcentaje = coste_actual_energia > 0
    ? Math.round((ahorro_mensual / coste_actual_energia) * 100)
    : 0

  return {
    coste_actual_energia: Math.round(coste_actual_energia * 100) / 100,
    coste_nuevo_energia: Math.round(coste_nuevo_energia * 100) / 100,
    coste_actual_potencia,
    coste_nuevo_potencia,
    ahorro_estimado_mensual: ahorro_mensual,
    ahorro_estimado_anual: Math.round(ahorro_mensual * 12 * 100) / 100,
    porcentaje_ahorro: porcentaje,
    kwh_anuales_sips: Math.round((data.kwh_total ?? 0) * 12),
    mercado_actual_mwh: Math.round(marketAvgMwh * 10) / 10,
    periodos,
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
    const [message, marketAvgMwh] = await Promise.all([
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              ...fileBlocks,
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
      fetchMarketAvgMwh(),
    ])

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(json)

    const savings = buildSavingsEstimate(parsed, marketAvgMwh)
    return NextResponse.json({ ...parsed, ...savings })
  } catch (err) {
    console.error('[process-invoice]', err)
    return NextResponse.json({ error: 'Error al analizar la factura con IA' }, { status: 500 })
  }
}
