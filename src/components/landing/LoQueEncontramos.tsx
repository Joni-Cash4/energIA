'use client'
import { motion } from 'framer-motion'
import { Gauge, ReceiptText, AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react'

const hallazgos = [
  {
    icon: Gauge,
    title: 'Potencia por encima de la necesaria',
    description: 'Empresas que llevan años pagando una potencia que nunca llegan a utilizar.',
  },
  {
    icon: ReceiptText,
    title: 'Errores en la factura',
    description:
      'Conceptos mal aplicados, lecturas estimadas o importes que no cuadran con el contrato firmado.',
  },
  {
    icon: AlertTriangle,
    title: 'Excesos de potencia y energía reactiva',
    description: 'Penalizaciones que se repiten mes a mes y que casi nadie revisa.',
  },
  {
    icon: RefreshCw,
    title: 'Renovaciones automáticas en peores condiciones',
    description: 'Contratos que se prorrogan solos con precios que ya no son competitivos.',
  },
  {
    icon: TrendingUp,
    title: 'Subidas de consumo sin explicación',
    description:
      'Cambios que pueden señalar una avería, un equipo mal configurado o un consumo que no debería estar ahí.',
  },
]

export function LoQueEncontramos() {
  return (
    <section className="py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Lo que solemos encontrar</h2>
          <p className="text-[#9CA3AF] text-lg max-w-2xl mx-auto">
            Cuando revisamos un suministro por primera vez, esto es lo que aparece con más
            frecuencia:
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-5">
          {hallazgos.map(({ icon: Icon, title, description }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 2) * 0.1, duration: 0.5 }}
              className="flex items-start gap-4 bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6 hover:border-[#00E676]/30 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[#00E676]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1.5">{title}</h3>
                <p className="text-[#9CA3AF] leading-relaxed">{description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center text-[#9CA3AF] text-lg max-w-2xl mx-auto mt-12"
        >
          No todas las empresas tienen todos estos problemas. Pero{' '}
          <span className="text-white font-medium">casi ninguna los tiene todos resueltos</span>.
        </motion.p>
      </div>
    </section>
  )
}
