import type { Metadata } from 'next'

// mercado/page.tsx es 'use client' -- no puede exportar metadata directamente,
// de ahí este layout server-only.
export const metadata: Metadata = {
  title: 'Precio de la luz en tiempo real',
  description:
    'Consulta el precio del mercado eléctrico español (OMIE) por hora, hoy y esta semana, y descubre cuándo conviene más consumir.',
  alternates: { canonical: 'https://www.iaenergia.es/mercado' },
}

export default function MercadoLayout({ children }: { children: React.ReactNode }) {
  return children
}
