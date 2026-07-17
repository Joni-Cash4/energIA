const TELEGRAM_API = 'https://api.telegram.org'

function botBase(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN no configurado')
  return `${TELEGRAM_API}/bot${token}`
}

function mimeFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  if (ext === 'oga' || ext === 'ogg') return 'audio/ogg'
  if (ext === 'mp3') return 'audio/mpeg'
  if (ext === 'wav') return 'audio/wav'
  if (ext === 'm4a') return 'audio/mp4'
  return 'audio/ogg'
}

export async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  await fetch(`${botBase()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

export async function downloadTelegramFile(fileId: string): Promise<{ base64: string; mimeType: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN no configurado')

  const infoRes = await fetch(`${botBase()}/getFile?file_id=${fileId}`)
  const info = await infoRes.json()
  if (!info.ok) throw new Error(`Telegram getFile falló: ${JSON.stringify(info)}`)
  const filePath: string = info.result.file_path

  const fileRes = await fetch(`${TELEGRAM_API}/file/bot${token}/${filePath}`)
  if (!fileRes.ok) throw new Error(`Descarga de audio de Telegram falló: ${fileRes.status}`)
  const arrayBuffer = await fileRes.arrayBuffer()

  return { base64: Buffer.from(arrayBuffer).toString('base64'), mimeType: mimeFromPath(filePath) }
}
