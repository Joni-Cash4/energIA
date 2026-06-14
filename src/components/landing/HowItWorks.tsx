'use client'
import { motion } from 'framer-motion'
import { Upload, BarChart2, Mail } from 'lucide-react'

const steps = [
  {
    icon: Upload,
    step: '01',
    title: 'Sube tu factura',
    description: 'Arrastra o selecciona el PDF de tu última factura eléctrica. Funciona con cualquier comercializadora.',
  },
  {
    icon: BarChart2,
    step: '02',
    title: 'Analizamos con IA',
    description: 'Nuestro sistema extrae automáticamente consumos, tarifas y periodos para calcular tu ahorro real.',
  },
  {
    icon: Mail,
    step: '03',
    title: 'Recibe tu informe',
    description: 'Te enviamos un informe personalizado con el comparativo y los pasos para cambiar de comercializadora.',
  },
]

export function HowItWorks() {
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-[#00E676] text-sm uppercase tracking-widest mb-3">Proceso</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Tan fácil como 1, 2, 3
          </h2>
          <p className="text-[#9CA3AF] text-lg max-w-xl mx-auto">
            En menos de un minuto sabes exactamente cuánto puedes ahorrar en tu factura.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map(({ icon: Icon, step, title, description }, i) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="relative bg-[#141414] border border-[#1F1F1F] rounded-2xl p-8 hover:border-[#00E676]/30 transition-colors group"
            >
              {/* Step number */}
              <span className="absolute top-6 right-6 text-4xl font-bold text-[#1F1F1F] group-hover:text-[#00E676]/10 transition-colors select-none">
                {step}
              </span>

              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center mb-5">
                <Icon className="w-6 h-6 text-[#00E676]" />
              </div>

              <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
              <p className="text-[#9CA3AF] leading-relaxed">{description}</p>

              {/* Connector arrow (not on last) */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 w-6 text-[#2A2A2A] text-xl select-none z-10">
                  →
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
