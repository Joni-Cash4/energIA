'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, ReferenceArea,
  BarChart, Bar, Cell,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, RefreshCw, Clock, Star, AlertTriangle, BarChart2, Zap } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Toaster } from '@/components/ui/toaster'
import { Button } from '@/components/ui/button'
import { getMarketPrices } from '@/lib/api'
import { formatNumber } from '@/lib/utils'
import type { MarketPrice, MarketHourlyResponse, HourlyPrice } from '@/types'

const PERIODO_LABELS: Record<string, string> = {
  P1: 'Punta (P1)', P2: 'Llano (P2)', P3: 'Valle (P3)',
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

function PeriodTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-xl">
      <p className="text-[#9CA3AF] text-xs mb-1">{PERIODO_LABELS[label] ?? label}</p>
      <p className="text-white font-bold">{formatNumber(payload[0].value, 2)} €/MWh</p>
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

type Tab = 'hoy' | 'periodos'

export default function MercadoPage() {
  const [tab, setTab] = useState<Tab>('hoy')
  const [hourly, setHourly] = useState<MarketHourlyResponse | null>(null)
  const [prices, setPrices] = useState<MarketPrice[]>([])
  const [loadingHourly, setLoadingHourly] = useState(true)
  const [loadingPeriods, setLoadingPeriods] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const loadHourly = async () => {
    setLoadingHourly(true)
    try {
      const res = await fetch('/api/market-hourly')
      if (res.ok) { setHourly(await res.json()); setLastUpdate(new Date()) }
    } catch { /* silent */ }
    setLoadingHourly(false)
  }

  const loadPeriods = async () => {
    setLoadingPeriods(true)
    try { setPrices(await getMarketPrices()) } catch { /* silent */ }
    setLoadingPeriods(false)
  }

  useEffect(() => { loadHourly(); loadPeriods() }, [])

  const maxPrice = prices.length ? Math.max(...prices.map((p) => p.precio_mwh)) : 0
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
            <Button variant="secondary" size="sm" onClick={() => { loadHourly(); loadPeriods() }} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loadingHourly ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </motion.div>

          {/* Semáforo del momento */}
          {hourly && !loadingHourly && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <PriceStatus precio={hourly.precio_ahora} media={hourly.media} />
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
                { label: 'Precio ahora', value: `${formatNumber(hourly.precio_ahora, 1)} €/MWh`, icon: Clock, accent: true },
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
            {([['hoy', 'Precio horario hoy'], ['periodos', 'Periodos tarifarios']] as [Tab, string][]).map(([t, label]) => (
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
                        x={hourly.ahora}
                        y={hourly.precio_ahora}
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
                    <NextHours precios={hourly.precios} ahora={hourly.ahora} />
                  </div>

                  {/* Consejo dinámico */}
                  <DynamicTip hourly={hourly} />
                </div>
              ) : (
                <div className="text-center py-20 text-[#6B7280]">
                  No se pudieron cargar los precios horarios. Inténtalo de nuevo.
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: Periodos */}
          {tab === 'periodos' && (
            <motion.div key="periodos" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {loadingPeriods ? (
                <div className="flex justify-center py-20">
                  <div className="w-8 h-8 rounded-full border-2 border-[#00E676]/30 border-t-[#00E676] animate-spin" />
                </div>
              ) : (
                <>
                  <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-5 mb-6">
                    <h2 className="text-white font-semibold mb-2">¿Qué son los periodos tarifarios?</h2>
                    <p className="text-[#9CA3AF] text-sm leading-relaxed">
                      En la tarifa 3.0TD, el precio varía según la franja horaria y el día de la semana.
                      <span className="text-red-400"> P1 (punta)</span>: 10-14h y 18-22h en laborables —
                      <span className="text-yellow-400"> P2 (llano)</span>: resto de horas laborables —
                      <span className="text-[#00E676]"> P3 (valle)</span>: noches y fines de semana.
                    </p>
                  </div>

                  <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6 mb-6">
                    <h2 className="text-white font-semibold mb-6">Precio por periodo (€/MWh)</h2>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={prices} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
                        <XAxis dataKey="periodo" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} width={55} tickFormatter={(v) => `${v} €`} />
                        <Tooltip content={<PeriodTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                        <Bar dataKey="precio_mwh" radius={[6, 6, 0, 0]}>
                          {prices.map((p) => (
                            <Cell
                              key={p.periodo}
                              fill={
                                p.precio_mwh === maxPrice ? '#EF4444' :
                                p.precio_mwh === Math.min(...prices.map(x => x.precio_mwh)) ? '#00E676' :
                                '#1565C0'
                              }
                              opacity={0.9}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#1F1F1F]">
                          {['Periodo', 'Descripción', '€/MWh', '€/kWh', 'Variación vs ayer'].map((h) => (
                            <th key={h} className="px-6 py-3.5 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {prices.map((p, i) => (
                          <motion.tr
                            key={p.periodo}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.05 * i }}
                            className="border-b border-[#1F1F1F] last:border-0 hover:bg-[#1A1A1A] transition-colors"
                          >
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                p.periodo === 'P1' ? 'bg-red-500/15 text-red-400' :
                                p.periodo === 'P2' ? 'bg-orange-500/15 text-orange-400' :
                                'bg-[#00E676]/15 text-[#00E676]'
                              }`}>{p.periodo}</span>
                            </td>
                            <td className="px-6 py-4 text-[#9CA3AF] text-sm">{PERIODO_LABELS[p.periodo] ?? p.periodo}</td>
                            <td className="px-6 py-4 text-white font-semibold">{formatNumber(p.precio_mwh, 2)}</td>
                            <td className="px-6 py-4 text-[#9CA3AF] text-sm">{formatNumber(p.precio_kwh, 4)}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1.5">
                                {p.variacion > 0
                                  ? <TrendingUp className="w-4 h-4 text-red-400" />
                                  : p.variacion < 0
                                    ? <TrendingDown className="w-4 h-4 text-[#00E676]" />
                                    : <Minus className="w-4 h-4 text-[#6B7280]" />
                                }
                                <span className={`text-sm font-medium ${p.variacion > 0 ? 'text-red-400' : p.variacion < 0 ? 'text-[#00E676]' : 'text-[#6B7280]'}`}>
                                  {p.variacion > 0 ? '+' : ''}{formatNumber(p.variacion, 1)}%
                                </span>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
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
