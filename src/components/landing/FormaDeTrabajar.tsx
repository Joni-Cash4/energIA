'use client'
import { motion } from 'framer-motion'

const parrafos = [
  'No queremos venderte electricidad. Queremos ayudarte a tomar mejores decisiones.',
  'Para la mayoría de asesores, el trabajo termina cuando firmas. Para nosotros, empieza justo ahí.',
  'Algunas veces te recomendaremos cambiar. Otras te diremos que lo mejor que puedes hacer es mantener tu contrato actual.',
  'Lo importante no es cuántos cambios hacemos, sino que cada decisión que tomes esté respaldada por datos y llegue en el momento adecuado.',
]

export function FormaDeTrabajar() {
  return (
    <section className="py-28 relative overflow-hidden">
      {/* subtle glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00E676]/[0.04] rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-[#00E676] text-sm uppercase tracking-widest mb-8"
        >
          Nuestra forma de trabajar
        </motion.p>

        <div className="space-y-6">
          {parrafos.map((p, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={
                i === 0
                  ? 'text-2xl sm:text-3xl font-semibold text-white leading-snug'
                  : 'text-lg text-[#9CA3AF] leading-relaxed'
              }
            >
              {p}
            </motion.p>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-10 text-lg text-white font-medium"
        >
          Nuestro compromiso es cuidar de la energía de tu empresa durante todo el año.
        </motion.p>
      </div>
    </section>
  )
}
