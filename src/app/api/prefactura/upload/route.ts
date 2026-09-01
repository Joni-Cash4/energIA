import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServerClient } from '@/lib/supabase-server'

const SYSTEM_PROMPT = `Eres un extractor de datos de prefacturas que una empresa pagadora (intermediaria de comisiones) manda por email a un agente energético. Tu única función es devolver un JSON válido con los datos extraídos. NUNCA expliques tu razonamiento, NUNCA escribas texto fuera del JSON, NUNCA uses markdown. Solo JSON.`

const PROMPT = `Analiza este documento (prefactura de comisiones) y devuelve ÚNICAMENTE el JSON especificado a continuación. Sin texto previo, sin explicaciones, sin markdown.

INSTRUCCIONES:
- numero_prefactura = el número/referencia de la prefactura tal como aparece en el documento (ej. "PRE-2026-0341"). Si no aparece, usa null.
- fecha = la fecha del documento en formato YYYY-MM-DD. Si no aparece, usa null.
- lineas = un array con una entrada por cada línea/concepto de comisión que aparezca desglosado en el documento (normalmente una por cliente, contrato o CUPS). Para cada línea:
  - referencia = el texto que identifica esa línea tal cual aparece (nombre de cliente, CUPS, concepto, número de contrato...). Cópialo literal, no inventes estructura si el documento no la tiene.
  - importe = el importe numérico de esa línea (sin símbolo de moneda ni separador de miles, usa punto decimal).
- Si el documento no es una prefactura o no contiene ninguna línea de importe reconocible (ej. es una factura de cliente, un DNI, una foto no relacionada), devuelve ÚNICAMENTE {"error": "no_reconocido"} y nada más.

Devuelve EXACTAMENTE este JSON (sin texto antes ni después):
{
  "numero_prefactura": string | null,
  "fecha": string | null,
  "lineas": [{ "referencia": string, "importe": number }]
}`

const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'application/pdf',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
}

const BUCKET = 'prefacturas'

type LineaExtraida = { referencia: string; importe: number }
type Extraccion = {
  error?: string
  numero_prefactura?: string | null
  fecha?: string | null
  lineas?: LineaExtraida[]
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  const empresaPagoId = form.get('empresaPagoId') as string | null

  if (!file || !ALLOWED_MIME[file.type]) {
    return NextResponse.json({ error: 'Sube una foto o PDF de la prefactura' }, { status: 400 })
  }
  if (!empresaPagoId) {
    return NextResponse.json({ error: 'Falta empresaPagoId' }, { status: 400 })
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
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: PROMPT }] }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(json) as Extraccion

    if (parsed.error === 'no_reconocido' || !parsed.lineas || parsed.lineas.length === 0) {
      return NextResponse.json(
        { error: 'No se han reconocido líneas de comisión en el documento. Sube una prefactura más clara.' },
        { status: 422 },
      )
    }

    // ── Upload evidencia a Storage ──────────────────────────────────────────
    // No se toca comision_cobros aquí: la IA propone, el asesor confirma
    // desde /dashboard/cobros tras revisar la conciliación. Bucket privado
    // (documento financiero de un tercero) — se sirve con createSignedUrl(),
    // nunca con getPublicUrl() (eso rompió en producción para un bucket
    // privado, ver comision-foto/upload/route.ts).
    await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {})
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${empresaPagoId}/${Date.now()}_${safeName}`
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: file.type, upsert: false })
    if (uploadErr) throw new Error(`Storage: ${uploadErr.message}`)

    return NextResponse.json({
      extraido: {
        numero_prefactura: parsed.numero_prefactura ?? null,
        fecha: parsed.fecha ?? null,
        lineas: parsed.lineas,
      },
      path: storagePath,
    })
  } catch (err) {
    console.error('[prefactura/upload]', err)
    return NextResponse.json({ error: 'Error al analizar la prefactura con IA' }, { status: 500 })
  }
}
