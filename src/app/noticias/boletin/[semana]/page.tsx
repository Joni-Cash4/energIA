import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BoletinView } from '@/components/boletin/BoletinView'
import { weekLabel, latestCompleteMonday } from '@/lib/boletin'

// URL propia por semana (/noticias/boletin/2026-06-29) — cada boletín queda
// indexable como contenido fresco semanal, con su metadata y JSON-LD.

export const revalidate = 3600

// Lunes válido, no futuro y dentro del archivo (25 semanas, igual que la API)
function parseMonday(semana: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(semana)) return null
  const d = new Date(semana + 'T00:00:00Z')
  if (isNaN(d.getTime()) || d.getUTCDay() !== 1) return null
  const latest = latestCompleteMonday()
  const oldest = new Date(latest)
  oldest.setUTCDate(oldest.getUTCDate() - 7 * 25)
  if (d > latest || d < oldest) return null
  return d
}

interface Props { params: Promise<{ semana: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { semana } = await params
  const monday = parseMonday(semana)
  if (!monday) return {}
  const label = weekLabel(monday)
  return {
    title: `Boletín del mercado eléctrico — ${label}`,
    description: `Análisis del mercado eléctrico español, ${label.toLowerCase()}: precio del mercado mayorista, demanda y mix de generación con datos de Red Eléctrica.`,
    alternates: { canonical: `/noticias/boletin/${semana}` },
  }
}

export default async function BoletinSemanaPage({ params }: Props) {
  const { semana } = await params
  const monday = parseMonday(semana)
  if (!monday) notFound()

  const label = weekLabel(monday)
  const domingo = new Date(monday)
  domingo.setUTCDate(domingo.getUTCDate() + 7) // lunes siguiente = fecha de publicación

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `El mercado eléctrico, ${label.toLowerCase()}`,
    datePublished: domingo.toISOString().split('T')[0],
    author: { '@type': 'Organization', name: 'IAenergía', url: 'https://www.iaenergia.es' },
    publisher: { '@type': 'Organization', name: 'IAenergía', url: 'https://www.iaenergia.es' },
    mainEntityOfPage: `https://www.iaenergia.es/noticias/boletin/${semana}`,
    about: 'Mercado eléctrico español: precios OMIE, demanda y mix de generación',
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BoletinView initialStart={semana} />
    </>
  )
}
