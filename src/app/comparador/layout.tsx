import type { Metadata } from 'next'

// comparador/page.tsx es 'use client' -- no puede exportar metadata directamente,
// de ahí este layout server-only.
export const metadata: Metadata = {
  title: 'Comparador de tarifas',
  description:
    'Sube tu factura eléctrica y descubre en segundos cuánto puedes ahorrar cambiando de tarifa. Análisis gratuito con tus datos reales.',
  alternates: { canonical: 'https://www.iaenergia.es/comparador' },
}

export default function ComparadorLayout({ children }: { children: React.ReactNode }) {
  return children
}
