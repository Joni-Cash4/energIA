'use client'
import { motion } from 'framer-motion'

const creencias = [
  'Creemos que los datos son más importantes que las opiniones.',
  'Creemos que conseguir un buen precio es solo el principio. Lo importante es seguir vigilándolo.',
  'Creemos que anticiparse cuesta menos que reclamar después.',
  'Creemos que la tecnología debe ayudarte a detectar oportunidades, no sustituir el criterio humano.',
]

export function Manifiesto() {
  return (
    <section className="py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl font-bold text-white text-center mb-14"
        >
          En qué creemos
        </motion.h2>

        <div className="space-y-8">
          {creencias.map((c, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-xl sm:text-2xl text-[#9CA3AF] leading-snug text-center"
            >
              {c}
            </motion.p>
          ))}

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-xl sm:text-2xl text-white font-semibold leading-snug text-center pt-2"
          >
            Y creemos que la confianza se gana siendo capaces de decir:{' '}
            <span className="text-[#00E676]">&ldquo;quédate como estás&rdquo;</span> cuando esa es
            realmente la mejor decisión.
          </motion.p>
        </div>
      </div>
    </section>
  )
}
