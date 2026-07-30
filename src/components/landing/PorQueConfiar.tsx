'use client'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

const items = [
  'La primera revisión no tiene coste ni compromiso.',
  'Trabajamos con tus datos reales, no con estimaciones.',
  'Cada recomendación va acompañada de los datos que la justifican.',
  'Nunca realizaremos ningún cambio sin tu autorización.',
  'Puedes dejar de trabajar con nosotros cuando quieras.',
]

export function PorQueConfiar() {
  return (
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl font-bold text-white text-center mb-12"
        >
          ¿Por qué confiar en nosotros?
        </motion.h2>

        <ul className="space-y-4">
          {items.map((item, i) => (
            <motion.li
              key={item}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="flex items-start gap-4 bg-[#141414] border border-[#1F1F1F] rounded-xl p-5"
            >
              <span className="w-7 h-7 rounded-full bg-[#00E676]/10 border border-[#00E676]/30 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-[#00E676]" />
              </span>
              <span className="text-[#E5E7EB] text-lg leading-relaxed">{item}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}
