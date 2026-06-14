'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Menu, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MarketHourlyResponse } from '@/types'

const links = [
  { href: '/comparador', label: 'Comparador' },
  { href: '/mercado',    label: 'Mercado',   live: true },
  { href: '/noticias',   label: 'Noticias' },
  { href: '/faq',        label: 'FAQ' },
  { href: '/contacto',   label: 'Contacto' },
]

function Ticker() {
  const [data, setData] = useState<MarketHourlyResponse | null>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/market-hourly')
      if (res.ok) setData(await res.json())
    } catch { /* silent */ }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  if (!data) return null

  const spainHour = parseInt(
    new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false }),
    10
  )
  const precioAhora = data.precios[spainHour]?.precio_mwh ?? data.precio_ahora

  return (
    <div className="w-full bg-[#0D0D0D] border-b border-[#1A1A1A] py-1.5 px-4 text-xs text-[#9CA3AF] flex items-center justify-center gap-1 overflow-hidden">
      <Zap className="w-3 h-3 text-[#00E676] shrink-0" />
      <span>Precio OMIE ahora:</span>
      <span className="text-[#00E676] font-semibold">{precioAhora.toFixed(1)} €/MWh</span>
      <span className="text-[#3A3A3A] mx-1">·</span>
      <span>Hoy:</span>
      <span className="text-white">mín {data.minimo.toFixed(1)}</span>
      <span className="text-[#3A3A3A]">—</span>
      <span className="text-white">máx {data.maximo.toFixed(1)} €/MWh</span>
    </div>
  )
}

export function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Ticker />
      <header className="sticky top-0 left-0 right-0 z-50 border-b border-[#1F1F1F] bg-[#0A0A0A]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#00E676] flex items-center justify-center group-hover:shadow-[0_0_12px_rgba(0,230,118,0.5)] transition-shadow">
              <Zap className="w-4 h-4 text-black fill-black" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              IA<span className="text-[#00E676]">energía</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  pathname === l.href
                    ? 'text-white bg-[#1F1F1F]'
                    : 'text-[#9CA3AF] hover:text-white hover:bg-[#141414]'
                )}
              >
                {l.label}
                {l.live && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#00E676]/15 border border-[#00E676]/30 text-[#00E676] text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse" />
                    EN VIVO
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="secondary" size="sm">Dashboard</Button>
            </Link>
            <Link href="/comparador">
              <Button size="sm">Analiza tu factura</Button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 text-[#9CA3AF] hover:text-white"
            onClick={() => setOpen(!open)}
            aria-label="Menú"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile slide-in menu */}
        <AnimatePresence>
          {open && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 top-16 bg-black/60 z-40 lg:hidden"
                onClick={() => setOpen(false)}
              />
              {/* Panel */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'tween', duration: 0.25 }}
                className="fixed top-16 right-0 bottom-0 w-72 bg-[#0D0D0D] border-l border-[#1F1F1F] z-50 flex flex-col p-4 gap-2 lg:hidden"
              >
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors',
                      pathname === l.href ? 'bg-[#1F1F1F] text-white' : 'text-[#9CA3AF] hover:text-white hover:bg-[#141414]'
                    )}
                  >
                    {l.label}
                    {l.live && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00E676]/15 border border-[#00E676]/30 text-[#00E676] text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse" />
                        EN VIVO
                      </span>
                    )}
                  </Link>
                ))}
                <div className="pt-4 mt-2 border-t border-[#1F1F1F] flex flex-col gap-2">
                  <Link href="/dashboard" onClick={() => setOpen(false)}>
                    <Button variant="secondary" className="w-full">Dashboard</Button>
                  </Link>
                  <Link href="/comparador" onClick={() => setOpen(false)}>
                    <Button className="w-full">Analiza tu factura</Button>
                  </Link>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>
    </>
  )
}
