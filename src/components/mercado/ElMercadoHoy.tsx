'use client'
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus, Flame, Clock, Star, AlertTriangle,
  CheckCircle2, ExternalLink,
} from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import type { InformeHoy, InformePlazoUrgente, InformeAyudaEuskadi } from '@/types'

function formatDateLong(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return dateStr
  const s = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-[#9CA3AF] text-xs mb-1">{label}</p>
      <p className="text-white font-bold text-base">{formatNumber(payload[0].value, 1)} €/MWh</p>
    </div>
  )
}

const SEVERITY_STYLE: Record<InformePlazoUrgente['severity'], { border: string; bg: string; text: string; icon: typeof AlertTriangle }> = {
  crit: { border: 'border-red-500/30', bg: 'bg-red-500/10', text: 'text-red-400', icon: AlertTriangle },
  warn: { border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: Clock },
}

const AID_STYLE: Record<InformeAyudaEuskadi['status'], { dot: string; text: string }> = {
  crit: { dot: 'bg-red-400', text: 'text-red-400' },
  warn: { dot: 'bg-yellow-400', text: 'text-yellow-400' },
  good: { dot: 'bg-[#00E676]', text: 'text-[#00E676]' },
}

function DeadlineCard({ d }: { d: InformePlazoUrgente }) {
  const s = SEVERITY_STYLE[d.severity]
  const Icon = s.icon
  return (
    <div className={`rounded-xl border p-4 ${s.border} ${s.bg}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 shrink-0 ${s.text}`} />
          <span className="text-[#6B7280] text-xs">{d.scope}</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.border} ${s.text}`}>{d.badge}</span>
      </div>
      <p className="text-white font-semibold text-sm mb-1">{d.title}</p>
      <p className="text-[#9CA3AF] text-xs mb-3">{d.description}</p>
      <a
        href={d.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-xs font-medium hover:underline ${s.text}`}
      >
        {d.sourceLabel} <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  )
}

function AidCard({ a }: { a: InformeAyudaEuskadi }) {
  const s = AID_STYLE[a.status]
  return (
    <div className="rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
        <p className="text-white font-semibold text-sm">{a.name}</p>
      </div>
      <p className="text-[#6B7280] text-xs mb-1">{a.scope} · Plazo: <span className={s.text}>{a.deadline}</span></p>
      <p className="text-[#9CA3AF] text-xs">{a.description}</p>
    </div>
  )
}

export function ElMercadoHoy() {
  const [data, setData] = useState<InformeHoy | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/informe-hoy')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (active) setData(json) })
      .catch(() => { if (active) setData(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-[#00E676]/30 border-t-[#00E676] animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-[#6B7280]">
        El resumen diario no está disponible en este momento.
      </div>
    )
  }

  const { market, trend3d, urgentDeadlines, openAidsEuskadi } = data

  const GasIcon = market.gasTrend === 'up' ? TrendingUp : market.gasTrend === 'down' ? TrendingDown : Minus
  const gasColor = market.gasTrend === 'up' ? 'text-red-400' : market.gasTrend === 'down' ? 'text-[#00E676]' : 'text-[#6B7280]'

  const PriceChangeIcon = market.avgPriceChangePct > 0 ? TrendingUp : market.avgPriceChangePct < 0 ? TrendingDown : Minus
  const priceChangeColor = market.avgPriceChangePct > 0 ? 'text-red-400' : market.avgPriceChangePct < 0 ? 'text-[#00E676]' : 'text-[#6B7280]'

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <p className="text-[#00E676] text-sm uppercase tracking-widest mb-1">Resumen diario</p>
        <h2 className="text-2xl font-bold text-white">El mercado energético, hoy</h2>
        <p className="text-[#6B7280] text-sm mt-1">{formatDateLong(data.date)}</p>
      </div>

      {/* 4 métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#141414] border border-[#00E676]/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <PriceChangeIcon className={`w-4 h-4 ${priceChangeColor}`} />
            <p className="text-[#6B7280] text-xs">Precio medio hoy</p>
          </div>
          <p className="text-[#00E676] font-bold text-sm sm:text-base">{formatNumber(market.avgPriceEurMwh, 1)} €/MWh</p>
          <p className={`text-xs mt-0.5 ${priceChangeColor}`}>
            {market.avgPriceChangePct > 0 ? '+' : ''}{formatNumber(market.avgPriceChangePct, 1)}% vs. ayer
          </p>
        </div>
        <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-[#00E676]" />
            <p className="text-[#6B7280] text-xs">Hora más barata</p>
          </div>
          <p className="text-white font-bold text-sm sm:text-base">{market.cheapestHour}</p>
          <p className="text-[#9CA3AF] text-xs mt-0.5">{formatNumber(market.cheapestPriceEurMwh, 1)} €/MWh</p>
        </div>
        <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <p className="text-[#6B7280] text-xs">Hora más cara</p>
          </div>
          <p className="text-white font-bold text-sm sm:text-base">{market.mostExpensiveHour}</p>
          <p className="text-[#9CA3AF] text-xs mt-0.5">{formatNumber(market.mostExpensivePriceEurMwh, 1)} €/MWh</p>
        </div>
        <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flame className={`w-4 h-4 ${gasColor}`} />
            <p className="text-[#6B7280] text-xs">Gas</p>
          </div>
          <p className="text-white font-bold text-sm sm:text-base">{formatNumber(market.gasPriceEurMwh, 1)} €/MWh</p>
          <p className={`text-xs mt-0.5 flex items-center gap-1 ${gasColor}`}>
            <GasIcon className="w-3 h-3" /> {market.gasTrend === 'up' ? 'Al alza' : market.gasTrend === 'down' ? 'A la baja' : 'Estable'}
          </p>
        </div>
      </div>

      {/* Tendencia 3 días */}
      {trend3d.length > 0 && (
        <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6 mb-8">
          <h3 className="text-white font-semibold mb-4">Tendencia — últimos días hábiles</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trend3d} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${v}€`} />
              <Tooltip content={<TrendTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="avgPriceEurMwh" fill="#00E676" radius={[4, 4, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Plazos urgentes */}
      {urgentDeadlines.length > 0 && (
        <div className="mb-8">
          <h3 className="text-white font-semibold mb-4">Plazos urgentes</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {urgentDeadlines.map((d, i) => <DeadlineCard key={i} d={d} />)}
          </div>
        </div>
      )}

      {/* Ayudas vigentes en Euskadi */}
      {openAidsEuskadi.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 text-[#00E676]" />
            <h3 className="text-white font-semibold">Ayudas vigentes en Euskadi</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {openAidsEuskadi.map((a, i) => <AidCard key={i} a={a} />)}
          </div>
        </div>
      )}
    </div>
  )
}
