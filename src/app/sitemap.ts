import type { MetadataRoute } from 'next'
import { NOTICIAS_PROPIAS } from '@/lib/noticias-propias'

const BASE_URL = 'https://www.iaenergia.es'

export default function sitemap(): MetadataRoute.Sitemap {
  const paginas: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/comparador`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/mercado`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/noticias`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/asesor`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/faq`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/contacto`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/privacidad`, changeFrequency: 'yearly', priority: 0.2 },
  ]

  const noticias: MetadataRoute.Sitemap = NOTICIAS_PROPIAS.map((n) => ({
    url: `${BASE_URL}/noticias/${n.id}`,
    lastModified: n.fecha,
    changeFrequency: 'monthly',
    priority: 0.5,
  }))

  return [...paginas, ...noticias]
}
