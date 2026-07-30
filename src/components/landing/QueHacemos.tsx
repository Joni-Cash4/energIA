'use client'
import { motion } from 'framer-motion'
import { ReceiptText, LineChart, Activity, Gauge, CalendarClock, MessageSquareText } from 'lucide-react'

const cards = [
  {
    icon: ReceiptText,
    title: 'Errores de facturación',
    description: 'Detectamos errores antes de que pagues de más.',
  },
  {
    icon: LineChart,
    title: 'Mercado eléctrico',
    description: 'Te avisamos únicamente cuando aparece una mejora que realmente merece la pena.',
  },
  {
    icon: Activity,
    title: 'Consumos fuera de lo normal',
    description: 'Identificamos cambios que pueden esconder una avería o un gasto innecesario.',
  },
  {
    icon: Gauge,
    title: 'Potencia contratada',
    description: 'Comprobamos si estás pagando más potencia de la que realmente necesitas.',
  },
  {
    icon: CalendarClock,
    title: 'Renovaciones',
    description:
      'Te avisamos antes de que un contrato venza para que tengas tiempo de decidir sin prisas.',
  },
  {
    icon: MessageSquareText,
    title: 'Información clara',
    description: 'Te explicamos lo que encontramos sin tecnicismos, para que decidir sea fácil.',
  },
]

export function QueHacemos() {
  return (
    <section className="py-24 bg-[#0D0D0D] border-y border-[#1F1F1F]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl font-bold text-white text-center mb-16"
        >
          ¿Qué hacemos mientras supervisamos tu energía?
        </motion.h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map(({ icon: Icon, title, description }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 3) * 0.12, duration: 0.5 }}
              className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-7 hover:border-[#00E676]/30 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center mb-5">
                <Icon className="w-5 h-5 text-[#00E676]" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
              <p className="text-[#9CA3AF] leading-relaxed">{description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
