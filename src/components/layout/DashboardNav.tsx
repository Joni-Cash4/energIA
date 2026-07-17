'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, FileText, Users, Inbox, Zap, LogOut,
  ChevronRight, TrendingUp, CalendarDays, Mail, Sliders, FileCheck, Receipt, Banknote, UserCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSupabaseClient } from '@/lib/supabase'

const navItems = [
  { href: '/dashboard',                label: 'Resumen',         icon: LayoutDashboard },
  { href: '/dashboard/nueva-factura',  label: 'Nueva Factura',   icon: FileText },
  { href: '/dashboard/simulador',      label: 'Simulador',       icon: Sliders },
  { href: '/dashboard/clientes',       label: 'Clientes',        icon: Users },
  { href: '/dashboard/leads',          label: 'Leads',           icon: Inbox },
  { href: '/dashboard/contratos',      label: 'Contratos',       icon: FileCheck, badge: 'contratos' },
  { href: '/dashboard/comisiones',     label: 'Comisiones',      icon: Receipt },
  { href: '/dashboard/facturacion',    label: 'Facturación',     icon: Banknote },
  { href: '/dashboard/cartera',        label: 'Cartera',         icon: TrendingUp },
  { href: '/dashboard/agenda',         label: 'Agenda',          icon: CalendarDays },
  { href: '/dashboard/contactos',      label: 'Mensajes web',    icon: Mail, badge: 'contactos' },
  { href: '/dashboard/asesor-foto',    label: 'Foto asesor',     icon: UserCircle },
]

export function DashboardNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [sinLeer, setSinLeer] = useState(0)
  const [proximosContratos, setProximosContratos] = useState(0)

  useEffect(() => {
    const supabase = getSupabaseClient()
    supabase.from('contactos').select('id', { count: 'exact' }).eq('leido', false)
      .then(({ count }) => setSinLeer(count ?? 0))
    const en30 = new Date(); en30.setDate(en30.getDate() + 30)
    supabase.from('contratos').select('id', { count: 'exact' })
      .lte('fecha_vencimiento', en30.toISOString().split('T')[0])
      .gte('fecha_vencimiento', new Date().toISOString().split('T')[0])
      .eq('renovacion_verificada', false)
      .eq('estado', 'activo')
      .then(({ count }) => setProximosContratos(count ?? 0))
  }, [])

  async function handleLogout() {
    await getSupabaseClient().auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-60 min-h-screen bg-[#0D0D0D] border-r border-[#1F1F1F] flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-[#1F1F1F]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#00E676] flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-black fill-black" />
          </div>
          <span className="font-bold text-base">
            IA<span className="text-[#00E676]">energía</span>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          const showBadge = (badge === 'contactos' && sinLeer > 0) || (badge === 'contratos' && proximosContratos > 0)
          const badgeCount = badge === 'contactos' ? sinLeer : proximosContratos
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors group',
                active
                  ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20'
                  : 'text-[#9CA3AF] hover:text-white hover:bg-[#1F1F1F]'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
              {showBadge && (
                <span className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 ${badge === 'contratos' ? 'bg-yellow-500' : 'bg-red-500'}`}>
                  {badgeCount > 9 ? '9+' : badgeCount}
                </span>
              )}
              {active && !showBadge && <ChevronRight className="w-3 h-3 shrink-0" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 border-t border-[#1F1F1F] pt-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-[#9CA3AF] hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
