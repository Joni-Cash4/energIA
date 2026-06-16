'use client'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingDown, Zap, Building2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { InvoiceAnalysis } from '@/types'

function CountUp({ target, duration = 1600 }: { target: number; duration?: number }) {
  const [value, setValue] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const steps = 60
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) { setValue(target); clearInterval(timer) }
      else setValue(Math.floor(current))
    }, duration / steps)
    return () => clearInterval(timer)
  }, [target, duration])

  return <>{formatCurrency(value, 0)}</>
}

interface Props {
  data: InvoiceAnalysis
  onContinue: () => void
}

export function Step2Results({ data, onContinue }: Props) {
  const savings = data.ahorro_estimado_anual
  const isPositive = savings >= 0
  const currentAnual = data.total_factura * 12
  const newAnual = currentAnual - savings
  const mesesGratis = Math.round(Math.abs(savings) / data.total_factura)
  const ahorroEnergia = data.coste_actual_energia - data.coste_nuevo_energia
  const ahorroPotencia = data.coste_actual_potencia - data.coste_nuevo_potencia

  // Caso tarifa actual más barata que la indexada de hoy: no mostramos ahorro roto
  if (!isPositive) {
    return (
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="text-center mb-8">
            <p className="text-[#00E676] text-sm uppercase tracking-widest mb-2">Análisis completado</p>
            <h2 className="text-2xl font-bold text-white">Hemos analizado tu factura</h2>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-8 mb-5 text-center"
          >
            <p className="text-[#9CA3AF] mb-3 text-sm uppercase tracking-wider">Tu tarifa actual</p>
            <p className="text-3xl font-bold text-white mb-2">{formatCurrency(data.total_factura, 0)}/mes</p>
            <p className="text-[#9CA3AF] text-sm">
              Con los precios de mercado de hoy, tu tarifa actual es más competitiva que la indexada.
              Aun así podemos revisar otras opciones (tarifa fija, otros periodos) en tu informe completo.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="flex flex-wrap gap-2 mb-8 justify-center"
          >
            {[
              { icon: Building2, label: 'Comercializadora', value: data.comercializadora },
              { icon: Zap, label: 'Tarifa', value: data.tarifa },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2 px-3 py-1.5 bg-[#1F1F1F] rounded-lg text-sm">
                <Icon className="w-3.5 h-3.5 text-[#6B7280]" />
                <span className="text-[#9CA3AF]">{label}:</span>
                <span className="text-white font-medium">{value}</span>
              </div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Button size="xl" onClick={onContinue} className="w-full gap-2 glow-green">
              Quiero el análisis completo gratuito
              <ArrowRight className="w-5 h-5" />
            </Button>
            <p className="text-center text-[#6B7280] text-xs mt-3">
              Te lo enviamos por email · Sin compromiso · Gratis
            </p>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="text-center mb-8">
          <p className="text-[#00E676] text-sm uppercase tracking-widest mb-2">Análisis completado</p>
          <h2 className="text-2xl font-bold text-white">Hemos analizado tu factura</h2>
        </div>

        {/* Main savings hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="relative overflow-hidden bg-[#141414] border border-[#00E676]/30 rounded-2xl p-8 mb-5 text-center"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#00E676]/5 to-transparent pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-0.5 bg-gradient-to-r from-transparent via-[#00E676] to-transparent" />

          <p className="text-[#9CA3AF] mb-3 text-sm uppercase tracking-wider">Podrías ahorrar</p>
          <motion.p
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 160 }}
            className="text-6xl sm:text-7xl font-bold text-[#00E676] mb-2 glow-green-text tabular-nums"
          >
            <CountUp target={savings} />
          </motion.p>
          <p className="text-[#9CA3AF] text-lg font-medium mb-5">al año</p>

          {/* Progress bar */}
          <div className="text-left mb-1">
            <div className="flex justify-between text-xs text-[#6B7280] mb-2">
              <span>Pagas ahora: {formatCurrency(currentAnual, 0)}/año</span>
              <span>Pagarías: {formatCurrency(newAnual, 0)}/año</span>
            </div>
            <div className="w-full h-3 bg-[#1F1F1F] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: `${(newAnual / currentAnual) * 100}%` }}
                transition={{ delay: 0.5, duration: 1, ease: 'easeOut' }}
                className="h-full bg-[#00E676] rounded-full"
              />
            </div>
            <p className="text-right text-xs text-[#00E676] mt-1 font-medium">
              {data.porcentaje_ahorro.toFixed(0)}% menos
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex items-center justify-center gap-2 mt-4"
          >
            <TrendingDown className="w-4 h-4 text-[#00E676]" />
            <span className="text-[#00E676] font-medium text-sm">
              Eso equivale a {mesesGratis} {mesesGratis === 1 ? 'mes' : 'meses'} de factura gratis al año
            </span>
          </motion.div>
        </motion.div>

        {/* Breakdown: energia + potencia */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="grid grid-cols-2 gap-4 mb-5"
        >
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4 text-center">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Ahorro en energía</p>
            <p className="text-xl font-bold text-[#00E676]">
              {formatCurrency(ahorroEnergia > 0 ? ahorroEnergia : savings * 0.8, 0)}/año
            </p>
          </div>
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4 text-center">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Ahorro en potencia</p>
            <p className="text-xl font-bold text-white">
              {formatCurrency(ahorroPotencia > 0 ? ahorroPotencia : savings * 0.2, 0)}/año
            </p>
          </div>
        </motion.div>

        {/* Detected info chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="flex flex-wrap gap-2 mb-8"
        >
          {[
            { icon: Building2, label: 'Comercializadora', value: data.comercializadora },
            { icon: Zap, label: 'Tarifa', value: data.tarifa },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-1.5 bg-[#1F1F1F] rounded-lg text-sm">
              <Icon className="w-3.5 h-3.5 text-[#6B7280]" />
              <span className="text-[#9CA3AF]">{label}:</span>
              <span className="text-white font-medium">{value}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1F1F1F] rounded-lg text-sm font-mono">
            <span className="text-[#9CA3AF]">CUPS:</span>
            <span className="text-white text-xs">{data.cups?.slice(0, 10)}…</span>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Button size="xl" onClick={onContinue} className="w-full gap-2 glow-green">
            Quiero el informe completo gratuito
            <ArrowRight className="w-5 h-5" />
          </Button>
          <p className="text-center text-[#6B7280] text-xs mt-3">
            Te lo enviamos por email · Sin compromiso · Gratis
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
