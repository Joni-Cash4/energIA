'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Zap, Leaf, Activity, AlertTriangle, Mail, Check } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Toaster } from '@/components/ui/toaster'
import { formatNumber } from '@/lib/utils'

interface DiaPrecio { fecha: string; label: string; media: number | null; mediaAnterior: number | null }
interface Tecnologia { nombre: string; renovable: boolean; gwh: number; cuota: number; variacion: number | null }
interface Boletin {
  semana: { inicio: string; fin: string; label: string }
  precios: {
    dias: DiaPrecio[]; media: number; mediaSemanaAnterior: number | null; variacionSemanal: number | null
    mediaAnyoPasado: number | null; variacionInteranual: number | null
    max: { fecha: string; media: number | null }; min: { fecha: string; media: number | null }
  }
  demanda: { gwh: number; variacionInteranual: number | null }
  generacion: {
    totalGwh: number; renovablesGwh: number; cuotaRenovable: number
    variacionRenovables: number | null; tecnologias: Tecnologia[]
  }
  textos: { mercado: string[]; balance: string[] }
  semanas: { inicio: string; label: string }[]
  fuente: string
}

function Variacion({ valor, invertir }: { valor: number | null; invertir?: boolean }) {
  if (valor == null) return <span className="text-[#6B7280]">—</span>
  // Para precios/demanda, subir es "malo" (rojo); para renovables, subir es "bueno" (verde)
  const positivo = invertir ? valor >= 0 : valor < 0
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${positivo ? 'text-[#00E676]' : 'text-red-400'}`}>
      {valor >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {valor >= 0 ? '+' : ''}{formatNumber(valor, 1)}%
    </span>
  )
}

function PrecioTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-[#9CA3AF] text-xs mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.stroke }} className="flex justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-bold">{p.value != null ? `${formatNumber(p.value, 1)} €/MWh` : '—'}</span>
        </p>
      ))}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, unit, sub }: {
  icon: any; label: string; value: string; unit?: string; sub?: React.ReactNode
}) {
  return (
    <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-5">
      <div className="flex items-center gap-2 text-[#6B7280] text-xs uppercase tracking-wide mb-2">
        <Icon className="w-4 h-4 text-[#00E676]" /> {label}
      </div>
      <p className="text-white text-2xl font-bold">
        {value}{unit && <span className="text-sm font-normal text-[#9CA3AF] ml-1">{unit}</span>}
      </p>
      {sub && <div className="text-xs mt-1.5">{sub}</div>}
    </div>
  )
}

function Suscripcion() {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok' | 'error'>('idle')
  const [mensaje, setMensaje] = useState('')

  const suscribir = async (e: React.FormEvent) => {
    e.preventDefault()
    setEstado('enviando')
    try {
      const res = await fetch('/api/boletin/suscribir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setEstado('ok')
      setMensaje(json.yaSuscrito ? 'Ya estabas suscrito — te llegará cada lunes.' : '¡Hecho! Cada lunes lo tendrás en tu correo.')
    } catch (err) {
      setEstado('error')
      setMensaje(err instanceof Error && err.message ? err.message : 'No se pudo completar la suscripción. Inténtalo de nuevo.')
    }
  }

  return (
    <div className="bg-gradient-to-r from-[#00E676]/10 to-transparent border border-[#00E676]/30 rounded-2xl p-5 sm:p-6 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-4 h-4 text-[#00E676]" />
        <p className="text-white font-semibold text-sm">Recibe el boletín cada lunes en tu correo</p>
      </div>
      <p className="text-[#9CA3AF] text-xs mb-4">Gratis, sin spam: solo el análisis semanal del mercado. Date de baja cuando quieras con un clic.</p>
      {estado === 'ok' ? (
        <p className="flex items-center gap-2 text-[#00E676] text-sm font-medium">
          <Check className="w-4 h-4" /> {mensaje}
        </p>
      ) : (
        <form onSubmit={suscribir} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="flex-1 bg-[#0A0A0A] border border-[#1F1F1F] text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#00E676]/50 placeholder:text-[#4B5563]"
          />
          <button
            type="submit"
            disabled={estado === 'enviando'}
            className="bg-[#00E676] text-black font-medium text-sm px-5 py-2.5 rounded-xl hover:bg-[#00C853] transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {estado === 'enviando' ? 'Suscribiendo…' : 'Suscribirme gratis'}
          </button>
        </form>
      )}
      {estado === 'error' && <p className="text-red-400 text-xs mt-2">{mensaje}</p>}
      <p className="text-[#4B5563] text-[11px] mt-3">
        Al suscribirte aceptas recibir el boletín semanal. Tratamos tu email conforme a nuestra{' '}
        <Link href="/privacidad" className="underline hover:text-[#9CA3AF]">política de privacidad</Link>.
      </p>
    </div>
  )
}

export default function BoletinPage() {
  const [data, setData] = useState<Boletin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [semana, setSemana] = useState<string>('')

  const load = async (inicio?: string) => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/boletin${inicio ? `?start=${inicio}` : ''}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json)
      setSemana(json.semana.inicio)
    } catch {
      setError(true)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const chartData = data?.precios.dias.map((d) => ({
    label: d.label,
    'Esta semana': d.media,
    'Mismo periodo año anterior': d.mediaAnterior,
  }))

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-16 pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto py-10">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <p className="text-[#00E676] text-sm uppercase tracking-widest mb-1">Boletín IAenergía</p>
            <h1 className="text-3xl font-bold text-white mb-2">El mercado eléctrico, esta semana</h1>
            <p className="text-[#9CA3AF] text-sm max-w-2xl">
              Análisis semanal con datos públicos de Red Eléctrica: precio del mercado mayorista,
              demanda y mix de generación. Redacción propia, sin letra pequeña.
            </p>
          </motion.div>

          {/* Suscripción por email */}
          <Suscripcion />

          {/* Selector de semana */}
          {data && (
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <label className="text-[#6B7280] text-sm">Semana:</label>
              <select
                value={semana}
                onChange={(e) => load(e.target.value)}
                className="bg-[#141414] border border-[#1F1F1F] text-white text-sm rounded-xl px-4 py-2 focus:outline-none focus:border-[#00E676]/50"
              >
                {data.semanas.map((s) => (
                  <option key={s.inicio} value={s.inicio}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {loading ? (
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => <div key={n} className="h-28 bg-[#141414] border border-[#1F1F1F] rounded-2xl" />)}
              </div>
              <div className="h-72 bg-[#141414] border border-[#1F1F1F] rounded-2xl" />
              <div className="h-64 bg-[#141414] border border-[#1F1F1F] rounded-2xl" />
            </div>
          ) : error || !data ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
              <p className="text-white font-medium">El boletín no está disponible en este momento</p>
              <p className="text-[#6B7280] text-sm">No hemos podido obtener los datos de Red Eléctrica. Inténtalo de nuevo en unos minutos.</p>
            </div>
          ) : (
            <div className="space-y-10">
              {/* KPIs */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={Zap} label="Precio medio spot" value={formatNumber(data.precios.media, 2)} unit="€/MWh"
                  sub={<span className="text-[#6B7280]">vs semana anterior <Variacion valor={data.precios.variacionSemanal} /></span>} />
                <KpiCard icon={Activity} label="Vs año anterior" value={data.precios.mediaAnyoPasado ? formatNumber(data.precios.mediaAnyoPasado, 2) : '—'} unit="€/MWh"
                  sub={<Variacion valor={data.precios.variacionInteranual} />} />
                <KpiCard icon={TrendingUp} label="Demanda peninsular" value={formatNumber(data.demanda.gwh, 0)} unit="GWh"
                  sub={<Variacion valor={data.demanda.variacionInteranual} />} />
                <KpiCard icon={Leaf} label="Cuota renovable" value={formatNumber(data.generacion.cuotaRenovable, 1)} unit="%"
                  sub={<Variacion valor={data.generacion.variacionRenovables} invertir />} />
              </motion.div>

              {/* Evolución del mercado */}
              <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <h2 className="text-white font-bold text-xl mb-1">Evolución del mercado</h2>
                <p className="text-[#6B7280] text-xs mb-4">{data.semana.label} · precio medio diario del mercado mayorista</p>
                <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-5">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
                        <XAxis dataKey="label" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={{ stroke: '#1F1F1F' }} tickLine={false} />
                        <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} unit="€" />
                        <Tooltip content={<PrecioTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }} />
                        <Line type="monotone" dataKey="Esta semana" stroke="#00E676" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                        <Line type="monotone" dataKey="Mismo periodo año anterior" stroke="#F97316" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-5 space-y-3">
                    {data.textos.mercado.map((p, i) => (
                      <p key={i} className="text-[#9CA3AF] text-sm leading-relaxed">{p}</p>
                    ))}
                  </div>
                </div>
              </motion.section>

              {/* Balance energético */}
              <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <h2 className="text-white font-bold text-xl mb-1">Balance energético</h2>
                <p className="text-[#6B7280] text-xs mb-4">Generación peninsular por tecnología · comparativa interanual</p>
                <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#1F1F1F]">
                          {['Tecnología', 'Generación (GWh)', 'Cuota', 'Variación interanual'].map((h) => (
                            <th key={h} className="px-5 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-[#1F1F1F] bg-[#00E676]/5">
                          <td className="px-5 py-3 text-white font-semibold flex items-center gap-2">
                            <Leaf className="w-4 h-4 text-[#00E676]" /> Renovables (total)
                          </td>
                          <td className="px-5 py-3 text-white font-semibold">{formatNumber(data.generacion.renovablesGwh, 0)}</td>
                          <td className="px-5 py-3 text-white font-semibold">{formatNumber(data.generacion.cuotaRenovable, 1)}%</td>
                          <td className="px-5 py-3"><Variacion valor={data.generacion.variacionRenovables} invertir /></td>
                        </tr>
                        {data.generacion.tecnologias.map((t) => (
                          <tr key={t.nombre} className="border-b border-[#1F1F1F] last:border-0">
                            <td className="px-5 py-3 text-[#D1D5DB]">
                              {t.nombre}
                              {t.renovable && <span className="ml-2 text-[10px] text-[#00E676] uppercase">renovable</span>}
                            </td>
                            <td className="px-5 py-3 text-[#D1D5DB]">{formatNumber(t.gwh, 0)}</td>
                            <td className="px-5 py-3 text-[#D1D5DB]">{formatNumber(t.cuota, 1)}%</td>
                            <td className="px-5 py-3"><Variacion valor={t.variacion} invertir={t.renovable} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-5 py-4 space-y-3 border-t border-[#1F1F1F]">
                    {data.textos.balance.map((p, i) => (
                      <p key={i} className="text-[#9CA3AF] text-sm leading-relaxed">{p}</p>
                    ))}
                  </div>
                </div>
              </motion.section>

              {/* Fuente + CTA */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <p className="text-[#6B7280] text-xs">Fuente: {data.fuente}</p>
                <Link href="/comparador"
                  className="inline-flex items-center gap-2 bg-[#00E676] text-black font-medium text-sm px-5 py-2.5 rounded-xl hover:bg-[#00C853] transition-colors">
                  <Zap className="w-4 h-4" /> ¿Pagas de más? Analiza tu factura gratis
                </Link>
              </motion.div>
            </div>
          )}
        </div>
      </main>
      <Footer />
      <Toaster />
    </>
  )
}
