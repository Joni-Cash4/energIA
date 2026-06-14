import Link from 'next/link'
import { Zap } from 'lucide-react'

const publicLinks = [
  { href: '/',           label: 'Inicio' },
  { href: '/comparador', label: 'Comparador' },
  { href: '/mercado',    label: 'Mercado' },
  { href: '/noticias',   label: 'Noticias' },
  { href: '/contacto',   label: 'Contacto' },
  { href: '/faq',        label: 'FAQ' },
]

export function Footer() {
  return (
    <footer className="border-t border-[#1F1F1F] bg-[#0D0D0D]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#00E676] flex items-center justify-center">
                <Zap className="w-4 h-4 text-black fill-black" />
              </div>
              <span className="font-bold text-lg">
                IA<span className="text-[#00E676]">energía</span>
              </span>
            </Link>
            <p className="text-[#6B7280] text-sm max-w-xs">
              Tu asesor energético independiente
            </p>
            <a
              href="mailto:contacto@iaenergia.es"
              className="text-[#6B7280] text-sm hover:text-[#00E676] transition-colors"
            >
              contacto@iaenergia.es
            </a>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {publicLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-[#6B7280] hover:text-white transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <Link href="/privacidad" className="text-sm text-[#6B7280] hover:text-white transition-colors">
              Privacidad
            </Link>
          </nav>
        </div>

        <div className="mt-10 pt-6 border-t border-[#1A1A1A] text-center text-xs text-[#4B5563]">
          © 2026 IAenergía · Todos los derechos reservados ·{' '}
          <a href="mailto:contacto@iaenergia.es" className="hover:text-[#6B7280]">
            contacto@iaenergia.es
          </a>
        </div>
      </div>
    </footer>
  )
}
