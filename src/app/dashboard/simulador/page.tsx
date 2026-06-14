'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sliders, TrendingDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatNumber } from '@/lib/utils'

const TARIFA_MEDIA_MWH = 130 // €/MWh referencia mercado

function calcular(kwh: number, kw: number, feeE: number, feeP: number) {
  const comisionMensual = (feeE * kwh / 12 / 1000) + (feeP * kw / 12)
  const comisionAnual   = comisionMensual * 12
  const ahorroCliente   = ((TARIFA_MEDIA_MWH - feeE) * kwh / 1000) * 0.18 // aprox 18% del total es margen
  const precioFinalMes  = (TARIFA_MEDIA_MWH * kwh / 12 / 1000) - (ahorroCliente / 12) + comisionMensual
  return { comisionMensual, comisionAnual, ahorroCliente, precioFinalMes }
}

const ESCENARIOS: { label: string; feeE: number; feeP: number }[] = [
  { label: 'Fee bajo',  feeE: 2,  feeP: 0.5 },
  { label: 'Fee medio', feeE: 5,  feeP: 1.5 },
  { label: 'Fee alto',  feeE: 10, feeP: 3.0 },
]

function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <label className="text-sm text-[#9CA3AF]">{label}</label>
        <span className="text-white font-semibold text-sm">{value} {unit}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#00E676]"
        style={{ background: `linear-gradient(to right, #00E676 0%, #00E676 ${((value - min) / (max - min)) * 100}%, #2A2A2A ${((value - min) / (max - min)) * 100}%, #2A2A2A 100%)` }}
      />
      <div className="flex justify-between mt-1 text-xs text-[#6B7280]">
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  )
}

export default function SimuladorPage() {
  const [kwh,  setKwh]  = useState(100000)
  const [kw,   setKw]   = useState(15)
  const [feeE, setFeeE] = useState(5)
  const [feeP, setFeeP] = useState(1.5)

  const result = calcular(kwh, kw, feeE, feeP)

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center">
          <Sliders className="w-5 h-5 text-[#00E676]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Simulador de fee</h1>
          <p className="text-[#6B7280] text-sm">Ajusta los parámetros para ver el impacto en comisión y precio final del cliente</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-6">
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-5">Datos del cliente</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-2">kWh anuales</label>
                <Input
                  type="number"
                  value={kwh}
                  onChange={(e) => setKwh(Number(e.target.value))}
                  min={1000} step={1000}
                />
              </div>
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-2">kW contratados</label>
                <Input
                  type="number"
                  value={kw}
                  onChange={(e) => setKw(Number(e.target.value))}
                  min={1} step={0.5}
                />
              </div>
            </div>
          </div>

          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-6">Fee a cobrar</h2>
            <div className="space-y-6">
              <Slider label="Fee energía" value={feeE} min={2} max={15} step={0.5} unit="€/MWh" onChange={setFeeE} />
              <Slider label="Fee potencia" value={feeP} min={0.5} max={5} step={0.1} unit="€/kW·año" onChange={setFeeP} />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-5">
          {/* Main result */}
          <motion.div
            key={`${feeE}-${feeP}-${kwh}-${kw}`}
            initial={{ opacity: 0.6, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-[#141414] border border-[#00E676]/25 rounded-2xl p-6"
          >
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#00E676] to-transparent rounded-t-2xl" style={{ position: 'relative' }} />
            <h2 className="text-white font-semibold mb-5">Resultado</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-[#0F0F0F] rounded-xl p-4 text-center">
                <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Tu comisión/mes</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(result.comisionMensual)}</p>
              </div>
              <div className="bg-[#00E676]/5 border border-[#00E676]/20 rounded-xl p-4 text-center">
                <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Tu comisión/año</p>
                <p className="text-2xl font-bold text-[#00E676]">{formatCurrency(result.comisionAnual)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0F0F0F] rounded-xl p-4 text-center">
                <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Ahorro del cliente</p>
                <p className="text-xl font-bold text-white">{formatCurrency(result.ahorroCliente, 0)}/año</p>
              </div>
              <div className="bg-[#0F0F0F] rounded-xl p-4 text-center">
                <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Precio final cliente</p>
                <p className="text-xl font-bold text-white">{formatCurrency(result.precioFinalMes)}/mes</p>
              </div>
            </div>
          </motion.div>

          {/* Scenarios table */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1F1F1F]">
              <h2 className="text-white font-semibold">Tabla comparativa de escenarios</h2>
              <p className="text-[#6B7280] text-xs mt-0.5">Con {formatNumber(kwh)} kWh/año y {kw} kW contratados</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1F1F1F]">
                  {['Escenario', 'Fee energía', 'Fee potencia', 'Com./mes', 'Com./año'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ESCENARIOS.map((s) => {
                  const r = calcular(kwh, kw, s.feeE, s.feeP)
                  const active = s.feeE === feeE && s.feeP === feeP
                  return (
                    <tr
                      key={s.label}
                      className={`border-b border-[#1F1F1F] last:border-0 transition-colors ${active ? 'bg-[#00E676]/5' : 'hover:bg-[#1A1A1A]'}`}
                    >
                      <td className="px-4 py-3">
                        <span className={`font-medium ${active ? 'text-[#00E676]' : 'text-white'}`}>{s.label}</span>
                        {active && <span className="ml-2 text-xs text-[#00E676]">← actual</span>}
                      </td>
                      <td className="px-4 py-3 text-[#9CA3AF]">{s.feeE} €/MWh</td>
                      <td className="px-4 py-3 text-[#9CA3AF]">{s.feeP} €/kW·año</td>
                      <td className="px-4 py-3 text-white font-medium">{formatCurrency(r.comisionMensual)}</td>
                      <td className="px-4 py-3 font-bold text-[#00E676]">{formatCurrency(r.comisionAnual)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[#6B7280] text-xs px-1">
            * Estimaciones orientativas basadas en precio medio OMIE {TARIFA_MEDIA_MWH} €/MWh y ahorro estimado del 18% sobre margen comercializadora.
          </p>
        </div>
      </div>
    </div>
  )
}
