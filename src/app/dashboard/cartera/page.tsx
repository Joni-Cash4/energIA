'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Zap, Users, DollarSign } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { Cliente } from '@/types'

function comisionMensual(c: Cliente) {
  const feeE = c.fee_energia ?? 0
  const feeP = c.fee_potencia ?? 0
  const kwh  = c.kwh_anuales ?? 0
  const kw   = c.kw_contratados ?? 0
  return (feeE * kwh / 12 / 1000) + (feeP * kw / 12)
}

export default function CarteraPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSupabaseClient()
      .from('clientes')
      .select('*')
      .in('estado', ['firmado'])
      .order('nombre')
      .then(({ data }) => { setClientes(data ?? []); setLoading(false) })
  }, [])

  const totalMensual = clientes.reduce((s, c) => s + comisionMensual(c), 0)
  const totalAnual   = totalMensual * 12
  const totalKwh     = clientes.reduce((s, c) => s + (c.kwh_anuales ?? 0), 0)

  const summaryCards = [
    { label: 'Clientes firmados',      value: clientes.length,                  icon: Users,       color: 'text-[#42A5F5]', bg: 'bg-[#1565C0]/10' },
    { label: 'Comisión mensual total', value: formatCurrency(totalMensual),      icon: DollarSign,  color: 'text-[#00E676]', bg: 'bg-[#00E676]/10', accent: true },
    { label: 'Comisión anual total',   value: formatCurrency(totalAnual),        icon: TrendingUp,  color: 'text-[#00E676]', bg: 'bg-[#00E676]/10' },
    { label: 'kWh bajo gestión/año',   value: `${formatNumber(totalKwh)} kWh`,   icon: Zap,         color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Seguimiento de cartera</h1>

      {/* Summary */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        {summaryCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className={`bg-[#141414] border rounded-xl p-5 ${s.accent ? 'border-[#00E676]/25' : 'border-[#1F1F1F]'}`}
          >
            <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center mb-4`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className={`text-2xl font-bold text-white ${loading ? 'opacity-30' : ''}`}>
              {loading ? '—' : s.value}
            </p>
            <p className="text-[#6B7280] text-sm mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 rounded-full border-2 border-[#00E676]/30 border-t-[#00E676] animate-spin" />
            </div>
          ) : clientes.length === 0 ? (
            <div className="py-16 text-center text-[#6B7280]">
              No hay clientes firmados aún.<br />
              <span className="text-xs">Cambia el estado de un cliente a "Firmado" para verlo aquí.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1F1F1F]">
                    {['Cliente', 'CUPS', 'kWh/año', 'kW cont.', 'Fee energía', 'Fee potencia', 'Com./mes', 'Com./año', 'Inicio contrato'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => {
                    const mes = comisionMensual(c)
                    return (
                      <tr key={c.id} className="border-b border-[#1F1F1F] last:border-0 hover:bg-[#1A1A1A] transition-colors">
                        <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{c.nombre}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#9CA3AF]">{c.cups?.slice(0, 14) ?? '—'}</td>
                        <td className="px-4 py-3 text-[#9CA3AF]">{c.kwh_anuales ? formatNumber(c.kwh_anuales) : '—'}</td>
                        <td className="px-4 py-3 text-[#9CA3AF]">{c.kw_contratados ?? '—'}</td>
                        <td className="px-4 py-3 text-[#9CA3AF]">{c.fee_energia ?? '—'} €/MWh</td>
                        <td className="px-4 py-3 text-[#9CA3AF]">{c.fee_potencia ?? '—'} €/kW·año</td>
                        <td className="px-4 py-3 font-semibold text-white">{formatCurrency(mes)}</td>
                        <td className="px-4 py-3 font-semibold text-[#00E676]">{formatCurrency(mes * 12)}</td>
                        <td className="px-4 py-3 text-[#6B7280] text-xs">{c.fecha_inicio_contrato ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Totals row */}
                {clientes.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-[#2A2A2A] bg-[#1A1A1A]">
                      <td colSpan={6} className="px-4 py-3 text-[#9CA3AF] text-xs font-medium uppercase tracking-wide">TOTAL</td>
                      <td className="px-4 py-3 font-bold text-white">{formatCurrency(totalMensual)}</td>
                      <td className="px-4 py-3 font-bold text-[#00E676]">{formatCurrency(totalAnual)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
