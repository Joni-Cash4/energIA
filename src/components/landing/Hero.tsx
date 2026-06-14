'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Zap, Shield, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.5, ease: 'easeOut' } }),
}

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#00E676 1px, transparent 1px), linear-gradient(90deg, #00E676 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00E676]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Pill badge */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#00E676]/30 bg-[#00E676]/5 text-[#00E676] text-sm font-medium mb-8">
            <Zap className="w-3.5 h-3.5" />
            Análisis instantáneo con IA
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-6"
        >
          Ahorra en tu{' '}
          <span className="gradient-text glow-green-text">factura eléctrica</span>
          <br />sin esfuerzo
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="text-lg sm:text-xl text-[#9CA3AF] max-w-2xl mx-auto mb-10"
        >
          Sube tu factura de luz y en segundos te decimos exactamente cuánto puedes ahorrar
          cambiando de comercializadora. Gratis, sin compromiso.
        </motion.p>

        {/* CTAs */}
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link href="/comparador">
            <Button size="xl" className="gap-2 glow-green">
              Analiza tu factura gratis
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <Link href="/mercado">
            <Button variant="secondary" size="xl">
              Ver precios de mercado
            </Button>
          </Link>
        </motion.div>

        {/* Trust chips */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#6B7280]"
        >
          {[
            { icon: Shield, text: 'Sin registrarte' },
            { icon: Zap, text: 'Resultado en 10 segundos' },
            { icon: TrendingDown, text: 'Ahorro medio 21%' },
          ].map(({ icon: Icon, text }) => (
            <span key={text} className="flex items-center gap-1.5">
              <Icon className="w-4 h-4 text-[#00E676]" />
              {text}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
