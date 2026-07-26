'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Zap, Users, DollarSign } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { calcularComisionContrato } from '@/lib/comisiones'
import type { Contrato, Cliente } from '@/types'

type Fila = Pick<Contrato,
  'id' | 'cliente_id' | 'cups' | 'comercializadora' | 'fecha_alta' |
  'kwh_base_comision' | 'fee_energia_mwh' | 'kw_base_comision' | 'fee_potencia_mwh' | 'reparto_energia'
> & { cliente: Pick<Cliente, 'nombre' | 'empresa'> | null }

export default function CarteraPage() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSupabaseClient()
      .from('contratos')
      .select('id,cliente_id,cups,comercializadora,fecha_alta,kwh_base_comision,fee_energia_mwh,kw_base_comision,fee_potencia_mwh,reparto_energia,cliente:clientes(nombre,empresa)')
      .eq('estado', 'activo')
      .order('fecha_alta', { ascending: false })
      .then(({ data }) => { setFilas((data ?? []) as unknown as Fila[]); setLoading(false) })
  }, [])

  const totalMensual = filas.reduce((s, f) => s + (calcularComisionContrato(f) ?? 0), 0) / 12
  const totalAnual   = totalMensual * 12
  const totalKwh     = filas.reduce((s, f) => s + (f.kwh_base_comision ?? 0), 0)
  const conDatos     = filas.filter(f => calcularComisionContrato(f) != null).length

  const summaryCards = [
    { label: 'Contratos activos',       value: filas.length,                    icon: Users,       color: 'text-[#42A5F5]', bg: 'bg-[#1565C0]/10' },
    { label: 'Comisión mensual (est.)', value: formatCurrency(totalMensual),     icon: DollarSign,  color: 'text-[#00E676]', bg: 'bg-[#00E676]/10', accent: true },
    { label: 'Comisión anual (est.)',   value: formatCurrency(totalAnual),       icon: TrendingUp,  color: 'text-[#00E676]', bg: 'bg-[#00E676]/10' },
    { label: 'kWh bajo gestión/año',    value: `${formatNumber(totalKwh)} kWh`,  icon: Zap,         color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Seguimiento de cartera</h1>
      <p className="text-[#6B7280] text-sm mb-8">
        Proyección estimada a partir del fee pactado por contrato (ver <span className="font-mono text-xs">/dashboard/comisiones</span>) —
        {conDatos < filas.length && ` ${filas.length - conDatos} de ${filas.length} contratos todavía sin fee/kWh base rellenos, no entran en el total.`}
      </p>

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
          ) : filas.length === 0 ? (
            <div className="py-16 text-center text-[#6B7280]">
              No hay contratos activos todavía.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1F1F1F]">
                    {['Cliente', 'CUPS', 'kWh base', 'Fee energía', 'Fee potencia', 'Com./mes', 'Com./año', 'Alta'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => {
                    const anual = calcularComisionContrato(f)
                    const mes = anual != null ? anual / 12 : null
                    return (
                      <tr key={f.id} className="border-b border-[#1F1F1F] last:border-0 hover:bg-[#1A1A1A] transition-colors">
                        <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                          {f.cliente?.nombre ?? '—'}{f.cliente?.empresa ? ` — ${f.cliente.empresa}` : ''}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#9CA3AF]">{f.cups?.slice(0, 14) ?? '—'}</td>
                        <td className="px-4 py-3 text-[#9CA3AF]">{f.kwh_base_comision ? formatNumber(f.kwh_base_comision) : '—'}</td>
                        <td className="px-4 py-3 text-[#9CA3AF]">{f.fee_energia_mwh ?? '—'} €/MWh</td>
                        <td className="px-4 py-3 text-[#9CA3AF]">{f.fee_potencia_mwh ? `${f.fee_potencia_mwh} €/kW` : '—'}</td>
                        <td className="px-4 py-3 font-semibold text-white">{mes != null ? formatCurrency(mes) : '—'}</td>
                        <td className="px-4 py-3 font-semibold text-[#00E676]">{anual != null ? formatCurrency(anual) : '—'}</td>
                        <td className="px-4 py-3 text-[#6B7280] text-xs">{f.fecha_alta ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr className="border-t-2 border-[#2A2A2A] bg-[#1A1A1A]">
                    <td colSpan={5} className="px-4 py-3 text-[#9CA3AF] text-xs font-medium uppercase tracking-wide">TOTAL</td>
                    <td className="px-4 py-3 font-bold text-white">{formatCurrency(totalMensual)}</td>
                    <td className="px-4 py-3 font-bold text-[#00E676]">{formatCurrency(totalAnual)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
