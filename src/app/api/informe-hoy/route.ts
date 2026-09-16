import { NextResponse } from 'next/server'
import type { InformeHoy } from '@/types'

export const revalidate = 3600

const GITHUB_REPO = 'Joni-Cash4/iaenergia-informes-boe'
const GITHUB_PATH = 'informes/hoy.json'

// Repo privado — requiere GITHUB_INFORMES_TOKEN (fine-grained PAT, solo lectura,
// scope limitado a este repo). Cualquier fallo (token ausente, repo sin datos ese
// día, rate limit...) responde null: el cliente oculta la sección sin romper la página.
export async function GET() {
  const token = process.env.GITHUB_INFORMES_TOKEN
  if (!token) {
    console.error('[informe-hoy] GITHUB_INFORMES_TOKEN no configurado')
    return NextResponse.json(null)
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.raw+json',
        },
        next: { revalidate: 3600 },
      }
    )

    if (!res.ok) {
      console.error('[informe-hoy] GitHub error', res.status, (await res.text().catch(() => '')).slice(0, 200))
      return NextResponse.json(null)
    }

    const data: InformeHoy = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[informe-hoy]', err)
    return NextResponse.json(null)
  }
}
