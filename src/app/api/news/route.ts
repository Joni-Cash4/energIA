import { NextResponse } from 'next/server'

interface RSSEntry {
  titulo: string
  resumen: string
  url: string
  fecha: string
  imagen: string
  fuente: string
}

const FEEDS = [
  { nombre: 'El Periódico de la Energía', url: 'https://www.elperiodicodelaenergia.com/feed/' },
  { nombre: 'Energías Renovables',        url: 'https://www.energias-renovables.com/feed/' },
  { nombre: 'Energía Diario',             url: 'https://www.energiadiario.com/feed/' },
  { nombre: 'PV Magazine España',         url: 'https://www.pv-magazine.es/feed/' },
]

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#\d+;/g, '')
    .trim()
}

function stripTags(str: string): string {
  return decodeEntities(str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
}

// Extract content from a tag, handling CDATA properly
function getTag(block: string, tag: string): string {
  // CDATA variant: <tag><![CDATA[...]]></tag>
  const cdataRe = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i')
  const cdata = block.match(cdataRe)
  if (cdata) return cdata[1].trim()

  // Plain text variant: <tag>...</tag>
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const plain = block.match(plainRe)
  if (plain) return stripTags(plain[1])

  return ''
}

// <link> in RSS is tricky — sometimes it has no closing tag or uses Atom format
function getLink(block: string): string {
  // Standard RSS: <link>URL</link> or <link><![CDATA[URL]]></link>
  const std = getTag(block, 'link')
  if (std && std.startsWith('http')) return std.trim()

  // Atom: <link href="URL" .../>
  const atom = block.match(/<link[^>]+href="([^"]+)"/i)
  if (atom) return atom[1].trim()

  // guid as fallback (often contains URL)
  const guid = getTag(block, 'guid')
  if (guid && guid.startsWith('http')) return guid.trim()

  return ''
}

function parseBlock(block: string, fuente: string): RSSEntry | null {
  const titulo = stripTags(getTag(block, 'title'))
  const url = getLink(block)
  const fecha =
    getTag(block, 'pubDate') ||
    getTag(block, 'dc:date') ||
    getTag(block, 'published') ||
    getTag(block, 'updated')
  const rawDesc =
    getTag(block, 'description') ||
    getTag(block, 'content:encoded') ||
    getTag(block, 'content') ||
    getTag(block, 'summary')
  const resumen = stripTags(rawDesc).slice(0, 240)

  const imgMatch =
    block.match(/enclosure[^>]+url="([^"]+\.(?:jpg|jpeg|png|webp|gif)[^"]*)"/i) ??
    block.match(/media:thumbnail[^>]+url="([^"]+)"/i) ??
    block.match(/media:content[^>]+url="([^"]+\.(?:jpg|jpeg|png|webp|gif)[^"]*)"/i) ??
    block.match(/<img[^>]+src="([^"]+)"/i)

  if (!titulo && !url) return null
  return { titulo, resumen, url, fecha, imagen: imgMatch ? imgMatch[1] : '', fuente }
}

function parseItems(xml: string, fuente: string): RSSEntry[] {
  const items: RSSEntry[] = []

  // RSS 2.0: <item>...</item>
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const entry = parseBlock(match[1], fuente)
    if (entry) items.push(entry)
    if (items.length >= 6) break
  }

  // Atom: <entry>...</entry> — used by REE, CNMC, and others
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi
    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = parseBlock(match[1], fuente)
      if (entry) items.push(entry)
      if (items.length >= 6) break
    }
  }

  return items
}

export async function GET() {
  const all: RSSEntry[] = []

  await Promise.allSettled(
    FEEDS.map(async ({ nombre, url }) => {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; IAenergia/1.0)',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          },
          next: { revalidate: 600 },
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) return
        const xml = await res.text()
        all.push(...parseItems(xml, nombre))
      } catch { /* skip failed feed */ }
    })
  )

  all.sort((a, b) => {
    const da = a.fecha ? new Date(a.fecha).getTime() : 0
    const db = b.fecha ? new Date(b.fecha).getTime() : 0
    return db - da
  })

  const noticias = all.slice(0, 20).map((n, i) => ({
    id: String(i),
    titulo: n.titulo,
    descripcion: n.resumen,
    url: n.url,
    imagen: n.imagen || undefined,
    fuente: n.fuente,
    fecha: n.fecha,
  }))

  return NextResponse.json({ noticias })
}
