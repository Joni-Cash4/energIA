import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServerClient } from '@/lib/supabase-server'

const SYSTEM_PROMPT = `Eres un extractor de datos de capturas de comisión que las comercializadoras eléctricas mandan a un agente energético al tramitar un alta o renovación. Tu única función es devolver un JSON válido con los datos extraídos. NUNCA expliques tu razonamiento, NUNCA escribas texto fuera del JSON, NUNCA uses markdown. Solo JSON.`

const PROMPT = `Analiza esta captura/foto/PDF de la comisión pactada para un contrato de electricidad y devuelve ÚNICAMENTE el JSON especificado a continuación. Sin texto previo, sin explicaciones, sin markdown.

INSTRUCCIONES:
- fee_energia_mwh = la comisión de energía en €/MWh, tal cual aparece en la fila/campo de fee o comisión de energía (ej. "FEE Energía €/MWh"). Si el documento la expresa en €/kWh, conviértela a €/MWh multiplicando ×1000.
- fee_potencia_mwh = la comisión de potencia en €/kW, tal cual aparece en la fila/campo de fee o comisión de potencia (ej. "FEE Potencia €/kW año"), SOLO si aparece explícitamente (no es habitual — la mayoría de comisiones son solo de energía). Si no aparece, usa null.
- NO confundas el fee (€/MWh o €/kW, el precio pactado) con un porcentaje de reparto (ej. una columna "Total" con valores como "100" o "65" que representan el % que paga la comercializadora, no un precio). Si el documento tiene ambas cosas, extrae SIEMPRE el valor de la fila de fee/comisión (€/MWh, €/kW), nunca el del reparto en %.
- producto = el nombre del producto/tarifa al que aplica esta comisión (ej. "Cristalina", "Atulado WEB", "Halley"), SOLO si aparece explícitamente en el documento. Si no aparece, usa null.
- Si el documento no contiene una comisión/fee en €/MWh reconocible (ej. es una factura, un DNI, una foto no relacionada), devuelve ÚNICAMENTE {"error": "no_reconocido"} y nada más.

Devuelve EXACTAMENTE este JSON (sin texto antes ni después):
{
  "fee_energia_mwh": number,
  "fee_potencia_mwh": number | null,
  "producto": string | null
}`

const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'application/pdf',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
}

const BUCKET = 'comision-fotos'

type Extraccion = {
  error?: string
  fee_energia_mwh?: number
  fee_potencia_mwh?: number | null
  producto?: string | null
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  const contratoId = form.get('contratoId') as string | null

  if (!file || !ALLOWED_MIME[file.type]) {
    return NextResponse.json({ error: 'Sube una foto o PDF de la comisión' }, { status: 400 })
  }
  if (!contratoId) {
    return NextResponse.json({ error: 'Falta contratoId' }, { status: 400 })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase server client no configurado' }, { status: 500 })
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mime = ALLOWED_MIME[file.type]
  const fileBlock = mime === 'application/pdf'
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mime as 'image/jpeg' | 'image/png' | 'image/webp', data: base64 } }

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: PROMPT }] }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(json) as Extraccion

    if (parsed.error === 'no_reconocido' || parsed.fee_energia_mwh == null) {
      return NextResponse.json(
        { error: 'No se ha reconocido una comisión (€/MWh) en el documento. Sube una captura más clara.' },
        { status: 422 },
      )
    }

    // ── Upload evidencia a Storage (mismo patrón que facturas-contrato/upload) ──
    // No se toca la tabla contratos aquí: la IA propone, el asesor confirma
    // desde el dashboard (comision-foto/upload solo extrae y guarda la
    // evidencia) — el UPDATE real lo hace el cliente al pulsar "Confirmar".
    await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {})
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${contratoId}/${Date.now()}_${safeName}`
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: file.type, upsert: false })
    if (uploadErr) throw new Error(`Storage: ${uploadErr.message}`)
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

    return NextResponse.json({
      extraido: {
        fee_energia_mwh: parsed.fee_energia_mwh,
        fee_potencia_mwh: parsed.fee_potencia_mwh ?? null,
        producto: parsed.producto ?? null,
      },
      foto_url: publicUrl,
    })
  } catch (err) {
    console.error('[comision-foto/upload]', err)
    return NextResponse.json({ error: 'Error al analizar la foto de la comisión con IA' }, { status: 500 })
  }
}
