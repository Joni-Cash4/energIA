import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Boletín semanal del mercado eléctrico',
  description:
    'Análisis semanal del mercado eléctrico español: precio del mercado mayorista, demanda y mix de generación con datos públicos de Red Eléctrica. Elaboración propia de IAenergía.',
}

export default function BoletinLayout({ children }: { children: React.ReactNode }) {
  return children
}
