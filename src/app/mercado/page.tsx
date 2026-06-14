'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, ReferenceArea,
  BarChart, Bar, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, RefreshCw, Clock, Star, AlertTriangle, BarChart2, Zap } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Toaster } from '@/components/ui/toaster'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'
import type { MarketHourlyResponse, HourlyPrice } from '@/types'

interface WeeklyDay { fecha: string; label: string; media: number }
interface WeeklyData {
  thisWeek: WeeklyDay[]
  lastWeek: WeeklyDay[]
  mediaEsta: number
  mediaAnterior: number
  variacion: number
}

function HourTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d: HourlyPrice = payload[0]?.payload
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-[#9CA3AF] text-xs mb-1">{`${d.hora}:00 — ${d.hora + 1}:00`}</p>
      <p className="text-white font-bold text-base">{formatNumber(d.precio_mwh, 1)} €/MWh</p>
      {d.es_barata && <p className="text-[#00E676] text-xs mt-1">✓ Buen momento para consumir</p>}
      {d.es_cara   && <p className="text-red-400 text-xs mt-1">⚠ Hora cara — intenta evitar</p>}
    </div>
  )
}

function WeekTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-[#9CA3AF] text-xs mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill }} className="flex justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-bold">{p.value ? `${formatNumber(p.value, 1)} €/MWh` : '—'}</span>
        </p>
      ))}
    </div>
  )
}

function PriceStatus({ precio, media }: { precio: number; media: number }) {
  const ratio = precio / media
  const status =
    ratio < 0.8  ? { label: 'BARATO', color: 'text-[#00E676]', bg: 'bg-[#00E676]/10 border-[#00E676]/30', dot: 'bg-[#00E676]', tip: 'Buen momento para poner lavadora, lavavajillas o cargar el coche.' } :
    ratio > 1.25 ? { label: 'CARO',   color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30',    dot: 'bg-red-400',    tip: 'Evita electrodomésticos de alto consumo si puedes esperar.' } :
                   { label: 'NORMAL', color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/30', dot: 'bg-yellow-400', tip: 'Precio en rango normal. Consume con normalidad.' }
  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl border ${status.bg} mb-8`}>
      <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
        <div className={`w-3 h-3 rounded-full ${status.dot} animate-pulse`} />
        <span className={`text-lg font-black tracking-wide ${status.color}`}>{status.label}</span>
      </div>
      <div className="h-10 w-px bg-white/10" />
      <div>
        <p className="text-white font-semibold text-sm">Precio actual: {formatNumber(precio, 1)} €/MWh</p>
        <p className="text-[#9CA3AF] text-xs mt-0.5">{status.tip}</p>
      </div>
    </div>
  )
}

function NextHours({ precios, ahora }: { precios: HourlyPrice[]; ahora: number }) {
  const next = [0, 1, 2, 3].map((i) => precios[(ahora + i) % 24]).filter(Boolean)
  return (
    <div className="grid grid-cols-4 gap-2 mt-4">
      {next.map((p, i) => (
        <div
          key={p.hora}
          className={`rounded-xl p-3 text-center border ${
            i === 0 ? 'border-[#00E676]/30 bg-[#00E676]/5' :
            p.es_barata ? 'border-[#00E676]/20 bg-[#00E676]/5' :
            p.es_cara   ? 'border-red-500/20 bg-red-500/5' :
            'border-[#1F1F1F] bg-[#0F0F0F]'
          }`}
        >
          <p className="text-[#6B7280] text-xs mb-1">{i === 0 ? 'Ahora' : `${p.hora}:00`}</p>
          <p className={`font-bold text-sm ${
            p.es_barata ? 'text-[#00E676]' : p.es_cara ? 'text-red-400' : 'text-white'
          }`}>
            {formatNumber(p.precio_mwh, 1)}
          </p>
          <p className="text-[#6B7280] text-xs">€/MWh</p>
        </div>
      ))}
    </div>
  )
}

function DynamicTip({ hourly }: { hourly: MarketHourlyResponse }) {
  const diff = hourly.maximo - hourly.minimo
  const ahorroPct = diff > 0 ? Math.round((diff / hourly.maximo) * 100) : 0
  const ahoraStatus = hourly.precio_ahora <= hourly.minimo * 1.15 ? 'barato' : hourly.precio_ahora >= hourly.maximo * 0.85 ? 'caro' : 'normal'

  return (
    <div className="mt-4 p-4 bg-[#0F0F0F] rounded-xl border border-[#1F1F1F]">
      <div className="flex items-start gap-2">
        <Zap className="w-4 h-4 text-[#00E676] shrink-0 mt-0.5" />
        <div className="text-xs text-[#9CA3AF] space-y-1">
          <p>
            Hoy la hora más barata es las <span className="text-[#00E676] font-medium">{hourly.hora_min}:00 ({formatNumber(hourly.minimo, 1)} €/MWh)</span> y la más cara las <span className="text-red-400 font-medium">{hourly.hora_max}:00 ({formatNumber(hourly.maximo, 1)} €/MWh)</span>.
          </p>
          {diff > 20 && (
            <p>
              Diferencia de {formatNumber(diff, 1)} €/MWh — desplazar consumos a la hora barata puede suponer un {ahorroPct}% menos en energía.
            </p>
          )}
          {ahoraStatus === 'barato' && <p className="text-[#00E676]">Momento favorable: considera poner lavadora, lavavajillas o cargar el vehículo eléctrico ahora.</p>}
          {ahoraStatus === 'caro'   && <p className="text-red-400">Precio alto en este momento. Aplaza electrodomésticos intensivos si puedes.</p>}
        </div>
      </div>
    </div>
  )
}

// ── Regulated costs (peajes + cargos, CNMC 2025, €/MWh) ─────────────────────
const REG_20TD = { P1: 59.0, P2: 16.7, P3: 2.2 }
const REG_30TD = { P1: 34.0, P2: 20.5, P3: 13.0, P4: 8.0, P5: 3.0, P6: 1.0 }
const IEE = 0.0511268
const IVA = 0.21

function periodo20TD(hour: number, dow: number): 'P1' | 'P2' | 'P3' {
  if (dow === 0 || dow === 6) return 'P3'
  if (hour < 8) return 'P3'
  if ((hour >= 10 && hour < 14) || (hour >= 18 && hour < 22)) return 'P1'
  return 'P2'
}

function periodo30TD(hour: number, dow: number): 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' {
  if (dow === 0) return 'P6'
  if (dow === 6) return 'P5'
  if (hour >= 9 && hour < 14) return 'P1'
  if ((hour >= 8 && hour < 9) || (hour >= 14 && hour < 19)) return 'P2'
  if (hour >= 19 && hour < 23) return 'P3'
  if (hour === 7 || hour === 23) return 'P4'
  return 'P6'
}

function precioFinal(spotMwh: number, regulated: number): number {
  const base = spotMwh + regulated
  return Math.round(base * (1 + IEE) * (1 + IVA) * 10) / 10
}

const PERIOD_COLORS: Record<string, string> = {
  P1: '#FF5252', P2: '#FFB74D', P3: '#42A5F5', P4: '#AB47BC', P5: '#26C6DA', P6: '#66BB6A',
}

function TarifaTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-[#9CA3AF] text-xs mb-1">{`${d.hora}:00 — ${d.hora + 1}:00`}</p>
      <p className="text-white font-bold text-base">{formatNumber(d.total, 1)} €/MWh</p>
      <p className="text-[#9CA3AF] text-xs mt-1">
        <span style={{ color: PERIOD_COLORS[d.periodo] }}>{d.periodo}</span>
        {' · '}spot {formatNumber(d.spot, 1)} + reg. {formatNumber(d.reg, 1)}
      </p>
    </div>
  )
}

type SubTarifa = '2.0TD' | '3.0TD'

function TarifaFinalChart({ precios, ahora }: { precios: HourlyPrice[]; ahora: number }) {
  const [tarifa, setTarifa] = useState<SubTarifa>('2.0TD')

  const now = new Date()
  const dow = now.getDay()

  const data = precios.map((p) => {
    const periodo = tarifa === '2.0TD' ? periodo20TD(p.hora, dow) : periodo30TD(p.hora, dow)
    const reg = tarifa === '2.0TD' ? REG_20TD[periodo as keyof typeof REG_20TD] : REG_30TD[periodo as keyof typeof REG_30TD]
    return {
      hora: p.hora,
      spot: p.precio_mwh,
      reg,
      total: precioFinal(p.precio_mwh, reg),
      periodo,
    }
  })

  const totalAhora = data[ahora]?.total ?? 0
  const totalMin = Math.min(...data.map((d) => d.total))
  const totalMax = Math.max(...data.map((d) => d.total))
  const horaMin = data.findIndex((d) => d.total === totalMin)
  const horaMax = data.findIndex((d) => d.total === totalMax)

  // Group consecutive hours by period for ReferenceArea
  const areas: { x1: number; x2: number; periodo: string }[] = []
  for (let i = 0; i < data.length; i++) {
    const p = data[i].periodo
    if (areas.length && areas[areas.length - 1].periodo === p) {
      areas[areas.length - 1].x2 = i + 1
    } else {
      areas.push({ x1: i, x2: i + 1, periodo: p })
    }
  }

  const periods = tarifa === '2.0TD'
    ? [{ id: 'P1', label: 'Punta', color: PERIOD_COLORS.P1 }, { id: 'P2', label: 'Llano', color: PERIOD_COLORS.P2 }, { id: 'P3', label: 'Valle', color: PERIOD_COLORS.P3 }]
    : [{ id: 'P1', label: 'P1', color: PERIOD_COLORS.P1 }, { id: 'P2', label: 'P2', color: PERIOD_COLORS.P2 }, { id: 'P3', label: 'P3', color: PERIOD_COLORS.P3 }, { id: 'P4', label: 'P4', color: PERIOD_COLORS.P4 }, { id: 'P5', label: 'P5', color: PERIOD_COLORS.P5 }, { id: 'P6', label: 'P6', color: PERIOD_COLORS.P6 }]

  return (
    <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-white font-semibold">Precio final estimado al consumidor</h2>
          <p className="text-[#6B7280] text-xs mt-0.5">Incluye energía + peajes + cargos + IEE + IVA. Sin término de potencia.</p>
        </div>
        <div className="flex gap-1 p-1 bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl">
          {(['2.0TD', '3.0TD'] as SubTarifa[]).map((t) => (
            <button
              key={t}
              onClick={() => setTarifa(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tarifa === t ? 'bg-[#00E676] text-black' : 'text-[#9CA3AF] hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Mini summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-[#0A0A0A] rounded-xl p-3 text-center border border-[#1F1F1F]">
          <p className="text-[#6B7280] text-xs mb-1">Ahora</p>
          <p className="text-white font-bold">{formatNumber(totalAhora, 1)} €/MWh</p>
          <p className="text-[#9CA3AF] text-xs">{formatNumber(totalAhora / 1000, 4)} €/kWh</p>
        </div>
        <div className="bg-[#0A0A0A] rounded-xl p-3 text-center border border-[#00E676]/20">
          <p className="text-[#6B7280] text-xs mb-1">Mínimo — {horaMin}:00</p>
          <p className="text-[#00E676] font-bold">{formatNumber(totalMin, 1)} €/MWh</p>
          <p className="text-[#9CA3AF] text-xs">{formatNumber(totalMin / 1000, 4)} €/kWh</p>
        </div>
        <div className="bg-[#0A0A0A] rounded-xl p-3 text-center border border-red-500/20">
          <p className="text-[#6B7280] text-xs mb-1">Máximo — {horaMax}:00</p>
          <p className="text-red-400 font-bold">{formatNumber(totalMax, 1)} €/MWh</p>
          <p className="text-[#9CA3AF] text-xs">{formatNumber(totalMax / 1000, 4)} €/kWh</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {periods.map((p) => (
          <span key={p.id} className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: p.color, opacity: 0.7 }} />
            {p.id} {p.label}
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
          <XAxis dataKey="hora" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(h) => `${h}h`} />
          <YAxis
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={55}
            tickFormatter={(v) => `${v}€`}
            domain={[(min: number) => Math.max(0, Math.floor(min / 10) * 10), (max: number) => Math.ceil(max / 10) * 10]}
          />
          <Tooltip content={<TarifaTooltip />} />
          {areas.map((a, i) => (
            <ReferenceArea key={i} x1={a.x1} x2={a.x2} fill={PERIOD_COLORS[a.periodo]} fillOpacity={0.08} />
          ))}
          <Line type="monotone" dataKey="total" stroke="#00E676" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#00E676' }} />
          <ReferenceDot x={ahora} y={totalAhora} r={7} fill="#00E676" stroke="#0A0A0A" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-[#4B5563] text-xs mt-4">
        * Estimación orientativa para tarifa {tarifa} residencial/empresarial. Peajes y cargos según CNMC 2025. No incluye término de potencia ni bono social.
      </p>
    </div>
  )
}

type Tab = 'hoy' | 'semana'

export default function MercadoPage() {
  const [tab, setTab] = useState<Tab>('hoy')
  const [hourly, setHourly] = useState<MarketHourlyResponse | null>(null)
  const [weekly, setWeekly] = useState<WeeklyData | null>(null)
  const [loadingHourly, setLoadingHourly] = useState(true)
  const [loadingWeekly, setLoadingWeekly] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const loadHourly = async () => {
    setLoadingHourly(true)
    try {
      const res = await fetch('/api/market-hourly')
      if (res.ok) { setHourly(await res.json()); setLastUpdate(new Date()) }
    } catch { /* silent */ }
    setLoadingHourly(false)
  }

  const loadWeekly = async () => {
    setLoadingWeekly(true)
    try {
      const res = await fetch('/api/market-weekly')
      if (res.ok) setWeekly(await res.json())
    } catch { /* silent */ }
    setLoadingWeekly(false)
  }

  useEffect(() => { loadHourly(); loadWeekly() }, [])

  // Compute current Spain hour client-side (browser knows local time)
  const spainHour = (() => {
    const now = new Date()
    return parseInt(now.toLocaleString('es-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false }), 10)
  })()
  const ahora = hourly ? spainHour : 0
  const precioAhora = hourly?.precios[ahora]?.precio_mwh ?? hourly?.precio_ahora ?? 0

  const cheapHours = hourly?.precios.filter((p) => p.es_barata).map((p) => p.hora) ?? []
  const expHours   = hourly?.precios.filter((p) => p.es_cara).map((p) => p.hora) ?? []

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-16 pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto py-10">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8"
          >
            <div>
              <p className="text-[#00E676] text-sm uppercase tracking-widest mb-1">Datos OMIE / REE</p>
              <h1 className="text-3xl font-bold text-white">Precios de mercado</h1>
              {lastUpdate && (
                <p className="text-[#6B7280] text-sm mt-1">Actualizado: {lastUpdate.toLocaleTimeString('es-ES')}</p>
              )}
            </div>
            <Button variant="secondary" size="sm" onClick={() => { loadHourly() }} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loadingHourly ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </motion.div>

          {/* Semáforo del momento */}
          {hourly && !loadingHourly && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <PriceStatus precio={precioAhora} media={hourly.media} />
            </motion.div>
          )}

          {/* Summary cards */}
          {hourly && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
            >
              {[
                { label: 'Precio ahora', value: `${formatNumber(precioAhora, 1)} €/MWh`, icon: Clock, accent: true },
                { label: 'Mejor hora hoy', value: `${hourly.hora_min}:00 · ${formatNumber(hourly.minimo, 1)} €`, icon: Star, color: 'text-[#00E676]' },
                { label: 'Hora más cara', value: `${hourly.hora_max}:00 · ${formatNumber(hourly.maximo, 1)} €`, icon: AlertTriangle, color: 'text-red-400' },
                { label: 'Media hoy', value: `${formatNumber(hourly.media, 1)} €/MWh`, icon: BarChart2, color: 'text-[#42A5F5]' },
              ].map(({ label, value, icon: Icon, accent, color }) => (
                <div key={label} className={`bg-[#141414] border rounded-xl p-4 ${accent ? 'border-[#00E676]/30' : 'border-[#1F1F1F]'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${color ?? (accent ? 'text-[#00E676]' : 'text-[#6B7280]')}`} />
                    <p className="text-[#6B7280] text-xs">{label}</p>
                  </div>
                  <p className={`font-bold text-sm sm:text-base ${accent ? 'text-[#00E676]' : color ?? 'text-white'}`}>{value}</p>
                </div>
              ))}
            </motion.div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-[#141414] border border-[#1F1F1F] rounded-xl mb-6 w-fit">
            {([['hoy', 'Precio horario hoy'], ['semana', 'Comparativa semanal']] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? 'bg-[#00E676] text-black' : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* TAB: Hourly */}
          {tab === 'hoy' && (
            <motion.div key="hoy" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {loadingHourly ? (
                <div className="flex justify-center py-20">
                  <div className="w-8 h-8 rounded-full border-2 border-[#00E676]/30 border-t-[#00E676] animate-spin" />
                </div>
              ) : hourly ? (
                <>
                <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-white font-semibold">Precio €/MWh — 24 horas</h2>
                    <div className="flex items-center gap-3 text-xs text-[#6B7280]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-1.5 rounded bg-[#00E676]/40 inline-block" />
                        Horas baratas
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-1.5 rounded bg-red-500/40 inline-block" />
                        Horas caras
                      </span>
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={hourly.precios} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                      <XAxis
                        dataKey="hora"
                        tick={{ fill: '#9CA3AF', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(h) => `${h}h`}
                      />
                      <YAxis
                        tick={{ fill: '#9CA3AF', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={50}
                        tickFormatter={(v) => `${v}€`}
                        domain={[
                          (min: number) => Math.min(0, Math.floor(min / 10) * 10),
                          (max: number) => Math.ceil(max / 10) * 10,
                        ]}
                      />
                      <Tooltip content={<HourTooltip />} />
                      {cheapHours.map((h) => (
                        <ReferenceArea key={`c${h}`} x1={h} x2={h + 1} fill="#00E676" fillOpacity={0.07} />
                      ))}
                      {expHours.map((h) => (
                        <ReferenceArea key={`e${h}`} x1={h} x2={h + 1} fill="#FF5252" fillOpacity={0.07} />
                      ))}
                      <Line
                        type="monotone"
                        dataKey="precio_mwh"
                        stroke="#1565C0"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4, fill: '#00E676' }}
                      />
                      <ReferenceDot
                        x={ahora}
                        y={precioAhora}
                        r={7}
                        fill="#00E676"
                        stroke="#0A0A0A"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Próximas horas */}
                  <div className="mt-6 border-t border-[#1F1F1F] pt-5">
                    <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-3">Próximas horas</p>
                    <NextHours precios={hourly.precios} ahora={ahora} />
                  </div>

                  {/* Consejo dinámico */}
                  <DynamicTip hourly={{ ...hourly, ahora, precio_ahora: precioAhora }} />
                </div>

                {/* Precio final al consumidor */}
                <TarifaFinalChart precios={hourly.precios} ahora={ahora} />
              </>
              ) : (
                <div className="text-center py-20 text-[#6B7280]">
                  No se pudieron cargar los precios horarios. Inténtalo de nuevo.
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: Semana */}
          {tab === 'semana' && (
            <motion.div key="semana" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {loadingWeekly ? (
                <div className="flex justify-center py-20">
                  <div className="w-8 h-8 rounded-full border-2 border-[#00E676]/30 border-t-[#00E676] animate-spin" />
                </div>
              ) : weekly ? (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4 text-center">
                      <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Media esta semana</p>
                      <p className="text-white font-bold text-xl">{formatNumber(weekly.mediaEsta, 1)} €/MWh</p>
                    </div>
                    <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4 text-center">
                      <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Media semana anterior</p>
                      <p className="text-white font-bold text-xl">{formatNumber(weekly.mediaAnterior, 1)} €/MWh</p>
                    </div>
                    <div className={`bg-[#141414] border rounded-xl p-4 text-center ${
                      weekly.variacion < 0 ? 'border-[#00E676]/30' : weekly.variacion > 0 ? 'border-red-500/30' : 'border-[#1F1F1F]'
                    }`}>
                      <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Variación</p>
                      <div className="flex items-center justify-center gap-1.5">
                        {weekly.variacion > 0
                          ? <TrendingUp className="w-5 h-5 text-red-400" />
                          : weekly.variacion < 0
                            ? <TrendingDown className="w-5 h-5 text-[#00E676]" />
                            : <Minus className="w-5 h-5 text-[#6B7280]" />
                        }
                        <p className={`font-bold text-xl ${
                          weekly.variacion < 0 ? 'text-[#00E676]' : weekly.variacion > 0 ? 'text-red-400' : 'text-[#6B7280]'
                        }`}>
                          {weekly.variacion > 0 ? '+' : ''}{formatNumber(weekly.variacion, 1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6">
                    <h2 className="text-white font-semibold mb-6">Precio medio diario €/MWh — últimas 2 semanas</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={weekly.thisWeek.map((d, i) => ({
                          label: d.label,
                          'Esta semana': d.media || null,
                          'Semana anterior': weekly.lastWeek[i]?.media || null,
                        }))}
                        barCategoryGap="20%"
                        barGap={4}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
                        <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} width={55} tickFormatter={(v) => `${v}€`} />
                        <Tooltip content={<WeekTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                        <Legend formatter={(v) => <span className="text-xs text-[#9CA3AF]">{v}</span>} wrapperStyle={{ paddingTop: 16 }} />
                        <Bar dataKey="Semana anterior" fill="#1565C0" radius={[4, 4, 0, 0]} opacity={0.6} />
                        <Bar dataKey="Esta semana" fill="#00E676" radius={[4, 4, 0, 0]} opacity={0.9} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Table */}
                  <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden mt-6">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#1F1F1F]">
                          {['Día', 'Esta semana', 'Semana anterior', 'Diferencia'].map((h) => (
                            <th key={h} className="px-6 py-3.5 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {weekly.thisWeek.map((d, i) => {
                          const prev = weekly.lastWeek[i]?.media ?? 0
                          const diff = d.media && prev ? d.media - prev : null
                          return (
                            <tr key={d.fecha} className="border-b border-[#1F1F1F] last:border-0 hover:bg-[#1A1A1A] transition-colors">
                              <td className="px-6 py-3.5 text-white font-medium capitalize">{d.label}</td>
                              <td className="px-6 py-3.5 text-[#00E676] font-semibold">
                                {d.media ? `${formatNumber(d.media, 1)} €/MWh` : '—'}
                              </td>
                              <td className="px-6 py-3.5 text-[#9CA3AF]">
                                {prev ? `${formatNumber(prev, 1)} €/MWh` : '—'}
                              </td>
                              <td className="px-6 py-3.5">
                                {diff !== null ? (
                                  <div className="flex items-center gap-1">
                                    {diff > 0
                                      ? <TrendingUp className="w-3.5 h-3.5 text-red-400" />
                                      : <TrendingDown className="w-3.5 h-3.5 text-[#00E676]" />
                                    }
                                    <span className={diff > 0 ? 'text-red-400' : 'text-[#00E676]'}>
                                      {diff > 0 ? '+' : ''}{formatNumber(diff, 1)}
                                    </span>
                                  </div>
                                ) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-20 text-[#6B7280]">No se pudieron cargar los datos semanales.</div>
              )}
            </motion.div>
          )}
        </div>
      </main>
      <Footer />
      <Toaster />
    </>
  )
}
