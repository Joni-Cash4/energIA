import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Hero } from '@/components/landing/Hero'
import { Stats } from '@/components/landing/Stats'
import { Transparencia } from '@/components/landing/Transparencia'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { Calculadora } from '@/components/landing/Calculadora'
import { FaqAccordion } from '@/components/landing/FaqAccordion'
import { FinalCTA } from '@/components/landing/FinalCTA'
import { PorQueAhorrar } from '@/components/landing/PorQueAhorrar'
import { ExitModal } from '@/components/landing/ExitModal'
import { Toaster } from '@/components/ui/toaster'

export const metadata: Metadata = {
  title: 'IAenergía — Tu asesor energético inteligente',
  description: 'Analiza tu factura eléctrica con inteligencia artificial. Descubre cuánto puedes ahorrar cambiando de comercializadora. Gratis y sin compromiso.',
  keywords: ['energía', 'ahorro', 'factura eléctrica', 'comparador luz', 'comercializadora', 'OMIE', 'tarifa indexada'],
  openGraph: {
    title: 'IAenergía — Tu asesor energético inteligente',
    description: 'Analiza tu factura y descubre tu ahorro potencial en segundos. Gratis.',
    url: 'https://iaenergia.es',
    siteName: 'IAenergía',
    type: 'website',
  },
  alternates: { canonical: 'https://iaenergia.es' },
}

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <Transparencia />
        <HowItWorks />
        <PorQueAhorrar />
        <Calculadora />
        <FaqAccordion />
        <FinalCTA />
      </main>
      <Footer />
      <Toaster />
      <ExitModal />
    </>
  )
}
