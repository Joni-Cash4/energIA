export async function transcribeAudio(buffer: Buffer, mimeType: string, filePath: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY no configurado')

  // Groq valida por la extensión del nombre de archivo (lista: flac mp3 mp4 mpeg mpga m4a ogg opus wav webm).
  // Telegram nombra las notas de voz con extensión .oga, que no está en esa lista aunque el contenido
  // sea el mismo Ogg/Opus — se normaliza a .ogg para que la validación de Groq lo acepte.
  const rawExt = (filePath.split('.').pop() || 'ogg').toLowerCase()
  const ext = rawExt === 'oga' ? 'ogg' : rawExt
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), `audio.${ext}`)
  form.append('model', 'whisper-large-v3')
  form.append('language', 'es')
  form.append('response_format', 'json')

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Groq transcripción falló: ${res.status} ${await res.text()}`)

  const data = await res.json()
  return (data.text ?? '').trim()
}
