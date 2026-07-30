'use client'
import { motion } from 'framer-motion'

const parrafos = [
  'Nuestra primera revisión no tiene ningún coste.',
  'Analizamos tu situación, revisamos tus contratos y te explicamos exactamente qué oportunidades vemos.',
  'Si decides trabajar con nosotros, cobramos de las comercializadoras con las que colaboramos, pero nuestra forma de cobrar nunca condiciona nuestras recomendaciones.',
  'Si tu contrato actual sigue siendo la mejor opción, te lo diremos.',
  'No pagas un extra por nuestro seguimiento.',
  'Y si alguna vez existe un servicio que tenga un coste para ti, te lo diremos antes de empezar. Nunca habrá sorpresas.',
]

export function ComoCobramos() {
  return (
    <section className="py-24 bg-[#0D0D0D] border-y border-[#1F1F1F]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#00E676] text-black text-lg font-bold mb-6">
            0 € para ti
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">¿Cómo cobramos?</h2>
        </motion.div>

        <div className="space-y-5">
          {parrafos.map((p, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className={
                i === 0
                  ? 'text-xl text-white font-semibold text-center'
                  : 'text-lg text-[#9CA3AF] leading-relaxed text-center'
              }
            >
              {p}
            </motion.p>
          ))}
        </div>
      </div>
    </section>
  )
}
