import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'EnergIA — Ahorra en tu factura eléctrica',
  description: 'Analiza tu factura de luz con inteligencia artificial y descubre cuánto puedes ahorrar cambiando de comercializadora.',
  keywords: ['energía', 'ahorro', 'factura eléctrica', 'comparador luz', 'comercializadora'],
  openGraph: {
    title: 'EnergIA — Ahorra en tu factura eléctrica',
    description: 'Analiza tu factura y descubre tu ahorro potencial en segundos.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased bg-[#0A0A0A] text-white`}>
        {children}
      </body>
    </html>
  )
}
