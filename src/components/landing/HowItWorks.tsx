'use client'
import { motion } from 'framer-motion'
import { Search, KeyRound, FileSearch, TrendingDown, BellRing, CheckCircle2 } from 'lucide-react'

const steps = [
  {
    icon: Search,
    title: 'Estudiamos tu situación',
    description:
      'Estudiamos tu consumo, tus contratos, la evolución del mercado y la potencia que realmente necesitas.',
  },
  {
    icon: KeyRound,
    title: 'Accedemos a tus datos',
    description: 'Con tu autorización, vía Datadis o un contador inteligente.',
  },
  {
    icon: FileSearch,
    title: 'Revisamos contratos y facturas',
    description:
      'Buscamos errores, oportunidades de ahorro y condiciones que ya no son las más adecuadas para ti.',
  },
  {
    icon: TrendingDown,
    title: 'Detectamos mejoras',
    description:
      'Solo te proponemos cambios cuando los datos demuestran que realmente merecen la pena.',
  },
  {
    icon: BellRing,
    title: 'Te avisamos',
    description:
      'No tendrás que estar pendiente del mercado. Si detectamos algo importante, seremos nosotros quienes te avisemos.',
  },
  {
    icon: CheckCircle2,
    title: 'Tú decides',
    description: 'Nosotros preparamos la decisión. Tomarla es cosa tuya.',
  },
]

export function HowItWorks() {
  return (
    <section id="como-trabajamos" className="py-24 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-[#00E676] text-sm uppercase tracking-widest mb-3">Proceso</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Cómo trabajamos</h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {steps.map(({ icon: Icon, title, description }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 3) * 0.12, duration: 0.5 }}
              className="relative bg-[#141414] border border-[#1F1F1F] rounded-2xl p-8 hover:border-[#00E676]/30 transition-colors group"
            >
              {/* Step number */}
              <span className="absolute top-6 right-6 text-4xl font-bold text-[#1F1F1F] group-hover:text-[#00E676]/10 transition-colors select-none">
                {String(i + 1).padStart(2, '0')}
              </span>

              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center mb-5">
                <Icon className="w-6 h-6 text-[#00E676]" />
              </div>

              <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
              <p className="text-[#9CA3AF] leading-relaxed">{description}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center text-[#9CA3AF] text-lg max-w-2xl mx-auto mt-14"
        >
          La tecnología analiza miles de datos. Nosotros los convertimos en{' '}
          <span className="text-white font-medium">decisiones claras</span> para tu empresa.
        </motion.p>
      </div>
    </section>
  )
}
