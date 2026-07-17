import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { sendTelegramMessage, downloadTelegramFile } from '@/lib/telegram'
import { transcribeAudio } from '@/lib/groq'

const EXTRACT_SYSTEM_PROMPT = `Eres un asistente que convierte transcripciones de notas de voz de un asesor energético en una gestión estructurada para su CRM. Tu única función es devolver un JSON válido. NUNCA expliques tu razonamiento, NUNCA escribas texto fuera del JSON, NUNCA uses markdown. Solo JSON.`

type ClienteLite = { id: string; nombre: string; empresa: string | null; comercializadora: string | null }

function buildExtractPrompt(transcripcion: string, clientes: ClienteLite[]): string {
  const listado = clientes.map(c => `${c.id} | ${c.nombre}${c.empresa ? ` (${c.empresa})` : ''}`).join('\n')
  return `Transcripción de una nota de voz de Jonathan (asesor energético) tras colgar una llamada con un cliente:
"""
${transcripcion}
"""

Lista de clientes existentes (id | nombre (empresa)):
${listado}

Extrae y devuelve ÚNICAMENTE este JSON:
{
  "asunto": "string - resumen breve (1-2 frases) de la gestión a realizar",
  "compania": "string|null - comercializadora o distribuidora mencionada (ej: TotalEnergies, i-DE), null si no se menciona",
  "cliente_id": "string|null - el id EXACTO de la lista de arriba del cliente que mejor coincide con el nombre mencionado en el audio, null si no hay ningún candidato razonable",
  "confianza": "alta|media|baja - alta solo si el nombre mencionado coincide claramente con un único cliente de la lista, sin ambigüedad",
  "titular_sugerido": "string|null - el nombre tal cual se mencionó en el audio, para mostrar si no hay match seguro",
  "proximo_seguimiento": "YYYY-MM-DD|null - solo si se menciona una fecha o plazo concreto, si no null"
}

Responde ÚNICAMENTE con el JSON, sin texto adicional ni bloques de código markdown.`
}

interface ExtractResult {
  asunto: string
  compania: string | null
  cliente_id: string | null
  confianza: 'alta' | 'media' | 'baja'
  titular_sugerido: string | null
  proximo_seguimiento: string | null
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: true })
  }

  const update = await req.json()
  const message = update.message
  const chatId: number | undefined = message?.chat?.id
  if (!chatId || String(chatId) !== process.env.TELEGRAM_ALLOWED_CHAT_ID) {
    return NextResponse.json({ ok: true })
  }

  const fileId: string | undefined = message.voice?.file_id ?? message.audio?.file_id
  if (!fileId) {
    return NextResponse.json({ ok: true })
  }

  try {
    const { buffer, mimeType, filePath } = await downloadTelegramFile(fileId)
    const transcripcion = await transcribeAudio(buffer, mimeType, filePath)

    if (!transcripcion) {
      await sendTelegramMessage(chatId, '⚠️ No he podido transcribir el audio (vacío o ininteligible).')
      return NextResponse.json({ ok: true })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, nombre, empresa, comercializadora')
      .order('nombre')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const extractMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: EXTRACT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildExtractPrompt(transcripcion, (clientes ?? []) as ClienteLite[]) }],
    })
    const raw = (extractMessage.content[0] as { type: string; text: string }).text.trim()
    const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(json) as ExtractResult

    const clienteMatch = parsed.confianza === 'alta'
      ? (clientes ?? []).find(c => c.id === parsed.cliente_id)
      : undefined
    const revisarCliente = !clienteMatch

    const payload = {
      user_id: process.env.JONATHAN_USER_ID!,
      cliente_id: clienteMatch?.id ?? null,
      titular: clienteMatch ? null : (parsed.titular_sugerido || null),
      compania: parsed.compania || clienteMatch?.comercializadora || 'Por confirmar',
      tipo: 'solicitamos' as const,
      asunto: parsed.asunto || transcripcion.slice(0, 200),
      via: 'telefono' as const,
      proximo_seguimiento: parsed.proximo_seguimiento || null,
      estado: 'pendiente' as const,
      origen: 'audio' as const,
      transcripcion,
      revisar_cliente: revisarCliente,
    }

    const { data: gestion, error } = await supabase.from('gestiones').insert(payload).select('id').single()
    if (error || !gestion) {
      console.error('Error insertando gestión desde audio', error)
      await sendTelegramMessage(chatId, `⚠️ Error al guardar la gestión: ${error?.message ?? 'sin dato'}`)
      return NextResponse.json({ ok: true })
    }

    await supabase.from('gestion_eventos').insert({
      gestion_id: gestion.id,
      user_id: process.env.JONATHAN_USER_ID!,
      nota: '[Sistema] Gestión creada desde nota de voz de Telegram',
    })

    const nombreTxt = clienteMatch ? clienteMatch.nombre : `${parsed.titular_sugerido || 'sin identificar'} ⚠️ revisar cliente`
    await sendTelegramMessage(chatId, `📝 Apuntado — ${nombreTxt}: ${payload.asunto}`)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error procesando audio de Telegram', err)
    const detail = err instanceof Error ? err.message : String(err)
    await sendTelegramMessage(chatId, `⚠️ Error procesando el audio: ${detail}`)
    return NextResponse.json({ ok: true })
  }
}
