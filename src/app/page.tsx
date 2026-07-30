import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Hero } from '@/components/landing/Hero'
import { DosManeras } from '@/components/landing/DosManeras'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { QueHacemos } from '@/components/landing/QueHacemos'
import { FormaDeTrabajar } from '@/components/landing/FormaDeTrabajar'
import { PorQueConfiar } from '@/components/landing/PorQueConfiar'
import { ComoCobramos } from '@/components/landing/ComoCobramos'
import { LoQueEncontramos } from '@/components/landing/LoQueEncontramos'
import { ResultadosReales } from '@/components/landing/ResultadosReales'
import { Vision } from '@/components/landing/Vision'
import { Manifiesto } from '@/components/landing/Manifiesto'
import { QuienEstaDetras } from '@/components/landing/QuienEstaDetras'
import { FinalCTA } from '@/components/landing/FinalCTA'
import { ExitModal } from '@/components/landing/ExitModal'
import { Toaster } from '@/components/ui/toaster'

export const metadata: Metadata = {
  title: 'IAenergía — Supervisión energética continua para empresas',
  description:
    'Monitorizamos continuamente la energía de tu empresa para detectar oportunidades de ahorro, errores de facturación y riesgos antes de que se conviertan en un problema. Primera revisión gratis y sin compromiso.',
  keywords: ['energía', 'ahorro', 'factura eléctrica', 'asesor energético', 'monitorización energética', 'empresas', 'Datadis', 'potencia contratada'],
  openGraph: {
    title: 'IAenergía — Supervisión energética continua para empresas',
    description: 'Tu energía debería trabajar para tu empresa. Nosotros nos ocupamos de que así sea.',
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
        <DosManeras />
        <HowItWorks />
        <QueHacemos />
        <FormaDeTrabajar />
        <PorQueConfiar />
        <ComoCobramos />
        <LoQueEncontramos />
        <ResultadosReales />
        <Vision />
        <Manifiesto />
        <QuienEstaDetras />
        <FinalCTA />
      </main>
      <Footer />
      <Toaster />
      <ExitModal />
    </>
  )
}
