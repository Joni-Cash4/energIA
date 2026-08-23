import type { Metadata } from 'next'

// contacto/page.tsx es 'use client' -- no puede exportar metadata directamente,
// de ahí este layout server-only.
export const metadata: Metadata = {
  title: 'Contacto',
  description:
    '¿Tienes dudas o quieres que analicemos tu caso? Escríbenos y te respondemos en menos de 24 horas laborables.',
  alternates: { canonical: 'https://www.iaenergia.es/contacto' },
}

export default function ContactoLayout({ children }: { children: React.ReactNode }) {
  return children
}
