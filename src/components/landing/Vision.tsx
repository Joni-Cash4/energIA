'use client'
import { motion } from 'framer-motion'
import { CalendarClock, ReceiptText, Gauge, TrendingDown } from 'lucide-react'

const mensaje = [
  { icon: CalendarClock, text: 'Un contrato renueva dentro de 25 días.' },
  { icon: ReceiptText, text: 'Una anomalía en una factura.' },
  { icon: Gauge, text: 'Un suministro con la potencia sobredimensionada.' },
  { icon: TrendingDown, text: 'Una alternativa que podría reducir el coste de uno de tus contratos.' },
]

export function Vision() {
  return (
    <section className="py-24 bg-[#0D0D0D] border-y border-[#1F1F1F]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <p className="text-[#00E676] text-sm uppercase tracking-widest mb-3">Nuestra visión</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            El <span className="gradient-text">copiloto energético</span> de tu empresa
          </h2>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-lg text-[#9CA3AF] leading-relaxed text-center max-w-2xl mx-auto mb-10"
        >
          Un copiloto no conduce. Avisa, anticipa y te da la información que necesitas para decidir a
          tiempo. Eso es exactamente lo que hacemos: analizamos, detectamos oportunidades,
          identificamos riesgos y solo te avisamos cuando de verdad merece la pena tomar una
          decisión.
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center text-[#9CA3AF] mb-8"
        >
          Queremos que gestionar la energía de tu empresa llegue a ser tan sencillo como recibir un
          único mensaje:
        </motion.p>

        {/* Mensaje de ejemplo */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative bg-[#141414] border border-[#00E676]/20 rounded-2xl p-7 sm:p-8 max-w-xl mx-auto"
        >
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#00E676]/50 to-transparent" />
          <p className="text-white font-semibold text-lg mb-1">Buenos días.</p>
          <p className="text-[#9CA3AF] mb-5">
            Hoy hemos encontrado cuatro cosas que merece la pena revisar:
          </p>
          <ul className="space-y-3">
            {mensaje.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <Icon className="w-5 h-5 text-[#00E676] shrink-0 mt-0.5" />
                <span className="text-[#E5E7EB]">{text}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center text-[#9CA3AF] text-lg max-w-2xl mx-auto mt-10"
        >
          Estamos construyendo IAenergía con un objetivo muy claro: que solo tengas que preocuparte
          por tu energía cuando realmente exista una decisión importante que tomar.
        </motion.p>
      </div>
    </section>
  )
}
