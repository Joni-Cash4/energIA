'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Users, Inbox, FileText, TrendingUp, ArrowRight, Plus, CalendarDays, Mail, Clock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSupabaseClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

interface Summary {
  leadsNuevos: number
  clientesActivos: number
  facturasSemana: number
  ahorroTotal: number
  agendaPendientes: number
  contactosSinLeer: number
  renovacionesProximas: number
  paraRevision: number
}

export default function DashboardHome() {
  const [s, setS] = useState<Summary>({
    leadsNuevos: 0, clientesActivos: 0, facturasSemana: 0,
    ahorroTotal: 0, agendaPendientes: 0, contactosSinLeer: 0,
    renovacionesProximas: 0, paraRevision: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseClient()
    const since  = new Date(); since.setDate(since.getDate() - 7)
    const en7    = new Date(); en7.setDate(en7.getDate() + 7)
    const en30   = new Date(); en30.setDate(en30.getDate() + 30)

    Promise.all([
      supabase.from('leads').select('id', { count: 'exact' }).eq('estado', 'nuevo'),
      supabase.from('clientes').select('id', { count: 'exact' }).in('estado', ['prospecto', 'reunion', 'oferta']),
      supabase.from('facturas').select('id, ahorro_estimado_anual').gte('created_at', since.toISOString()),
      supabase.from('clientes').select('id', { count: 'exact' }).not('proximo_contacto', 'is', null).lte('proximo_contacto', en7.toISOString().split('T')[0]),
      supabase.from('contactos').select('id', { count: 'exact' }).eq('leido', false),
      supabase.from('contratos').select('id', { count: 'exact' })
        .eq('estado', 'activo').eq('renovacion_verificada', false)
        .gte('fecha_vencimiento', new Date().toISOString().split('T')[0])
        .lte('fecha_vencimiento', en30.toISOString().split('T')[0]),
      supabase.from('clientes').select('id', { count: 'exact' }).eq('revision_pendiente', true),
    ]).then(([leads, clientes, facturas, agenda, contactos, renovaciones, revision]) => {
      const semana = facturas.data ?? []
      setS({
        leadsNuevos:          leads.count ?? 0,
        clientesActivos:      clientes.count ?? 0,
        facturasSemana:       semana.length,
        ahorroTotal:          semana.reduce((a, f) => a + (f.ahorro_estimado_anual ?? 0), 0),
        agendaPendientes:     agenda.count ?? 0,
        contactosSinLeer:     contactos.count ?? 0,
        renovacionesProximas: renovaciones.count ?? 0,
        paraRevision:         revision.count ?? 0,
      })
      setLoading(false)
    })
  }, [])

  const statsCards = [
    { label: 'Leads nuevos',        value: s.leadsNuevos,                         icon: Inbox,        color: 'text-[#00E676]', bg: 'bg-[#00E676]/10',  href: '/dashboard/leads' },
    { label: 'Clientes activos',    value: s.clientesActivos,                      icon: Users,        color: 'text-[#42A5F5]', bg: 'bg-[#1565C0]/10',  href: '/dashboard/clientes' },
    { label: 'Facturas (7 días)',   value: s.facturasSemana,                       icon: FileText,     color: 'text-purple-400', bg: 'bg-purple-500/10', href: '/dashboard/clientes' },
    { label: 'Ahorro detectado',    value: formatCurrency(s.ahorroTotal, 0),       icon: TrendingUp,   color: 'text-[#00E676]', bg: 'bg-[#00E676]/10',  href: '/dashboard/clientes' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Resumen</h1>
          <p className="text-[#6B7280] text-sm mt-1">Bienvenido de vuelta</p>
        </div>
        <Link href="/dashboard/nueva-factura">
          <Button className="gap-2"><Plus className="w-4 h-4" />Nueva factura</Button>
        </Link>
      </div>

      {/* Alert widgets */}
      {!loading && (s.renovacionesProximas > 0 || s.paraRevision > 0 || s.agendaPendientes > 0 || s.contactosSinLeer > 0) && (
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {s.renovacionesProximas > 0 && (
            <Link href="/dashboard/contratos" className="flex items-center gap-3 p-4 bg-[#141414] border border-yellow-500/25 rounded-xl hover:border-yellow-500/50 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">
                  {s.renovacionesProximas} {s.renovacionesProximas === 1 ? 'contrato vence' : 'contratos vencen'} en los próximos 30 días
                </p>
                <p className="text-[#6B7280] text-xs mt-0.5">Gestionar renovaciones</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#6B7280] group-hover:text-yellow-400 transition-colors shrink-0" />
            </Link>
          )}
          {s.paraRevision > 0 && (
            <Link href="/dashboard/clientes?tab=revision" className="flex items-center gap-3 p-4 bg-[#141414] border border-amber-400/25 rounded-xl hover:border-amber-400/50 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-amber-400/10 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">
                  {s.paraRevision} {s.paraRevision === 1 ? 'cliente pendiente' : 'clientes pendientes'} de revisión
                </p>
                <p className="text-[#6B7280] text-xs mt-0.5">Sin contrato registrado o vencido &gt;1 año</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#6B7280] group-hover:text-amber-400 transition-colors shrink-0" />
            </Link>
          )}
          {s.agendaPendientes > 0 && (
            <Link href="/dashboard/agenda" className="flex items-center gap-3 p-4 bg-[#141414] border border-[#00E676]/25 rounded-xl hover:border-[#00E676]/50 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-[#00E676]/10 flex items-center justify-center shrink-0">
                <CalendarDays className="w-4 h-4 text-[#00E676]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">
                  📅 {s.agendaPendientes} {s.agendaPendientes === 1 ? 'cliente pendiente' : 'clientes pendientes'} de contactar esta semana
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#6B7280] group-hover:text-[#00E676] transition-colors shrink-0" />
            </Link>
          )}
          {s.contactosSinLeer > 0 && (
            <Link href="/dashboard/contactos" className="flex items-center gap-3 p-4 bg-[#141414] border border-red-500/25 rounded-xl hover:border-red-500/50 transition-colors group">
              <div className="relative w-9 h-9 shrink-0">
                <div className="w-full h-full rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-red-400" />
                </div>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
                  {s.contactosSinLeer}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">
                  {s.contactosSinLeer} {s.contactosSinLeer === 1 ? 'mensaje nuevo' : 'mensajes nuevos'} sin leer
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#6B7280] group-hover:text-red-400 transition-colors shrink-0" />
            </Link>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        {statsCards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Link href={card.href} className="block bg-[#141414] border border-[#1F1F1F] rounded-xl p-5 hover:border-[#2A2A2A] transition-colors group">
              <div className={`w-10 h-10 ${card.bg} rounded-lg flex items-center justify-center mb-4`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <p className={`text-2xl font-bold text-white ${loading ? 'opacity-30' : ''}`}>{loading ? '—' : card.value}</p>
              <p className="text-[#6B7280] text-sm mt-1">{card.label}</p>
              <div className="flex items-center gap-1 mt-3 text-xs text-[#6B7280] group-hover:text-[#00E676] transition-colors">
                Ver detalle <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h2 className="text-white font-semibold mb-4">Acciones rápidas</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { href: '/dashboard/nueva-factura', label: 'Procesar nueva factura', desc: 'Sube un PDF o consulta por CUPS',       icon: FileText },
            { href: '/dashboard/simulador',     label: 'Simulador de fee',       desc: 'Calcula tu comisión y precio al cliente', icon: TrendingUp },
            { href: '/dashboard/cartera',       label: 'Ver cartera',            desc: 'Comisión total y kWh bajo gestión',      icon: Users },
            { href: '/dashboard/leads',         label: 'Gestionar leads',        desc: 'Revisa y convierte leads del comparador', icon: Inbox },
            { href: '/dashboard/agenda',        label: 'Agenda semanal',         desc: 'Clientes pendientes de contactar',       icon: CalendarDays },
            { href: '/dashboard/contactos',     label: 'Mensajes web',           desc: 'Formularios de contacto recibidos',      icon: Mail },
          ].map(({ href, label, desc, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-start gap-4 p-4 bg-[#141414] border border-[#1F1F1F] rounded-xl hover:border-[#00E676]/30 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-[#1F1F1F] group-hover:bg-[#00E676]/10 flex items-center justify-center shrink-0 transition-colors">
                <Icon className="w-4 h-4 text-[#6B7280] group-hover:text-[#00E676] transition-colors" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">{label}</p>
                <p className="text-[#6B7280] text-xs mt-0.5">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
