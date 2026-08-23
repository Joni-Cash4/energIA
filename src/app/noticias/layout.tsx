import type { Metadata } from 'next'

// noticias/page.tsx es 'use client' -- no puede exportar metadata directamente,
// de ahí este layout server-only. (noticias/[id] y noticias/boletin ya tienen
// su propia metadata, este layout no les afecta.)
export const metadata: Metadata = {
  title: 'Noticias del sector eléctrico',
  description:
    'Últimas noticias sobre el mercado eléctrico, tarifas, regulación y ahorro energético para empresas.',
  alternates: { canonical: 'https://www.iaenergia.es/noticias' },
}

export default function NoticiasLayout({ children }: { children: React.ReactNode }) {
  return children
}
