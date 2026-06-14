import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { FaqAccordion, FAQ_ITEMS } from '@/components/landing/FaqAccordion'
import { Toaster } from '@/components/ui/toaster'

export const metadata: Metadata = {
  title: 'Preguntas frecuentes — IAenergía',
  description: 'Resolvemos tus dudas sobre el cambio de comercializadora, tarifas indexadas, el CUPS y nuestros servicios.',
  openGraph: { title: 'FAQ — IAenergía', description: 'Todo lo que necesitas saber sobre el ahorro en tu factura eléctrica.' },
}

export default function FaqPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-16">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-[#00E676] text-sm uppercase tracking-widest mb-3">FAQ</p>
          <h1 className="text-4xl font-bold text-white mb-4">Preguntas frecuentes</h1>
          <p className="text-[#9CA3AF] text-lg">
            Todo lo que necesitas saber antes de dar el paso.
          </p>
        </div>
        <FaqAccordion items={FAQ_ITEMS} showLink={false} />
      </main>
      <Footer />
      <Toaster />
    </>
  )
}
