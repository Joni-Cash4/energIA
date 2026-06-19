import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { WhatsAppButton } from '@/components/landing/WhatsAppButton'
import { CookieBanner } from '@/components/landing/CookieBanner'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.iaenergia.es'),
  title: {
    default: 'IAenergía — Ahorra en tu factura eléctrica',
    template: '%s — IAenergía',
  },
  description: 'Analiza tu factura de luz con inteligencia artificial y descubre cuánto puedes ahorrar cambiando de tarifa.',
  keywords: ['energía', 'ahorro', 'factura eléctrica', 'comparador luz', 'tarifa eléctrica', 'IAenergía'],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'IAenergía — Ahorra en tu factura eléctrica',
    description: 'Analiza tu factura y descubre tu ahorro potencial en segundos.',
    type: 'website',
    url: 'https://www.iaenergia.es',
    siteName: 'IAenergía',
    locale: 'es_ES',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased bg-[#0A0A0A] text-white`}>
        {children}
        <WhatsAppButton />
        <CookieBanner />
      </body>
    </html>
  )
}
