import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const PROMPT = `Analiza esta factura eléctrica española y extrae los datos clave.

Devuelve ÚNICAMENTE este JSON exacto (sin texto adicional):
{
  "numero_factura": "string (número o referencia de factura, ej: FELEC 2600385882)",
  "fecha_factura": "YYYY-MM-DD",
  "periodo_inicio": "YYYY-MM-DD",
  "periodo_fin": "YYYY-MM-DD",
  "cups": "string (empieza por ES, 20-22 chars)",
  "comercializadora": "string",
  "kwh_total": number,
  "importe_total": number,
  "importe_base": number
}

Si algún campo no aparece, usa null.`

const BUCKET = 'facturas-contrato'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const pdf = form.get('pdf') as File | null
    let clienteId = form.get('clienteId') as string | null

    if (!pdf) {
      return NextResponse.json({ error: 'Falta campo: pdf' }, { status: 400 })
    }

    const bytes = await pdf.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    // ── Claude extraction ──────────────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document' as const,
            source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
          },
          { type: 'text' as const, text: PROMPT },
        ],
      }],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Claude no devolvió JSON')
    const ex = JSON.parse(match[0]) as {
      numero_factura?: string; fecha_factura?: string
      periodo_inicio?: string; periodo_fin?: string
      cups?: string; comercializadora?: string
      kwh_total?: number; importe_total?: number; importe_base?: number
    }

    const supabase = getSupabase()

    // ── Auto-detect clienteId from CUPS if not provided ────────────────────────
    if (!clienteId && ex.cups) {
      const { data: cliente } = await supabase
        .from('clientes')
        .select('id')
        .eq('cups', ex.cups)
        .single()
      if (cliente) clienteId = cliente.id
    }

    if (!clienteId) {
      return NextResponse.json(
        { error: `Cliente no encontrado para CUPS ${ex.cups ?? '(no detectado)'}`, cups: ex.cups },
        { status: 404 },
      )
    }

    // ── Skip if invoice already exists ────────────────────────────────────────
    if (ex.numero_factura) {
      const { data: existing } = await supabase
        .from('facturas_contrato')
        .select('id')
        .eq('cliente_id', clienteId)
        .eq('numero_factura', ex.numero_factura)
        .single()
      if (existing) {
        return NextResponse.json({ skipped: true, motivo: 'ya_existe', numero_factura: ex.numero_factura })
      }
    }

    // ── Upload PDF to Supabase Storage ─────────────────────────────────────────
    await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {})

    const fileName = `${clienteId}/${Date.now()}_${pdf.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, bytes, { contentType: 'application/pdf', upsert: false })
    if (uploadErr) throw new Error(`Storage: ${uploadErr.message}`)

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(fileName)

    // ── Save to facturas_contrato ──────────────────────────────────────────────
    const precio_kwh_efectivo =
      ex.kwh_total && ex.kwh_total > 0 && ex.importe_total
        ? ex.importe_total / ex.kwh_total
        : null

    const { data: factura, error: insertErr } = await supabase
      .from('facturas_contrato')
      .insert({
        cliente_id: clienteId,
        cups: ex.cups ?? null,
        comercializadora: ex.comercializadora ?? null,
        numero_factura: ex.numero_factura ?? null,
        fecha_factura: ex.fecha_factura ?? null,
        periodo_inicio: ex.periodo_inicio ?? null,
        periodo_fin: ex.periodo_fin ?? null,
        kwh_total: ex.kwh_total ?? null,
        importe_total: ex.importe_total ?? null,
        importe_base: ex.importe_base ?? null,
        precio_kwh_efectivo,
        pdf_url: publicUrl,
        datos_extraidos: ex,
      })
      .select()
      .single()

    if (insertErr) throw new Error(`Insert: ${insertErr.message}`)

    return NextResponse.json({ factura })
  } catch (err) {
    console.error('[facturas-contrato/upload]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
