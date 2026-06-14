'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'

interface StatItem {
  value: number
  suffix: string
  prefix?: string
  label: string
  decimals?: number
}

const stats: StatItem[] = [
  { value: 637, suffix: '€', label: 'Ahorro medio anual por cliente' },
  { value: 21, suffix: '%', label: 'Reducción de factura eléctrica' },
  { value: 1240, suffix: '+', label: 'Facturas analizadas' },
  { value: 10, suffix: 's', label: 'Para conocer tu ahorro' },
]

function AnimatedCounter({ value, suffix, prefix = '', decimals = 0, label }: StatItem) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  useEffect(() => {
    if (!inView) return
    const duration = 1800
    const steps = 60
    const increment = value / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= value) {
        setCount(value)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [inView, value])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <div className="text-4xl sm:text-5xl font-bold text-white mb-2">
        <span className="text-[#00E676]">{prefix}</span>
        {decimals > 0 ? count.toFixed(decimals) : count.toLocaleString('es-ES')}
        <span className="text-[#00E676]">{suffix}</span>
      </div>
      <p className="text-[#6B7280] text-sm sm:text-base">{label}</p>
    </motion.div>
  )
}

export function Stats() {
  return (
    <section className="py-24 border-y border-[#1F1F1F]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-[#6B7280] text-sm uppercase tracking-widest mb-12"
        >
          Resultados reales
        </motion.p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {stats.map((s) => (
            <AnimatedCounter key={s.label} {...s} />
          ))}
        </div>
      </div>
    </section>
  )
}
