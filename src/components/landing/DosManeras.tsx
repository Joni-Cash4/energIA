'use client'
import { motion } from 'framer-motion'
import { X, Check } from 'lucide-react'

const filas = [
  { tradicional: 'Revisas cuando te acuerdas', iaenergia: 'Revisamos continuamente' },
  { tradicional: 'Esperas a la renovación', iaenergia: 'Nos adelantamos a la renovación' },
  {
    tradicional: 'Descubres los problemas cuando ya han ocurrido',
    iaenergia: 'Te avisamos antes de que se conviertan en un problema',
  },
  {
    tradicional: 'Cambias porque parece mejor',
    iaenergia: 'Solo proponemos cambios cuando los datos lo justifican',
  },
]

export function DosManeras() {
  return (
    <section className="py-24 bg-[#0D0D0D] border-y border-[#1F1F1F]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl font-bold text-white text-center mb-12"
        >
          Dos maneras de gestionar la energía de tu empresa
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid md:grid-cols-2 gap-4 md:gap-6"
        >
          {/* Gestión tradicional */}
          <div className="rounded-2xl border border-[#1F1F1F] bg-[#141414] p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-[#9CA3AF] mb-6">Gestión tradicional</h3>
            <ul className="space-y-4">
              {filas.map((f) => (
                <li key={f.tradicional} className="flex items-start gap-3">
                  <X className="w-5 h-5 text-[#6B7280] shrink-0 mt-0.5" />
                  <span className="text-[#9CA3AF]">{f.tradicional}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* IAenergía */}
          <div className="rounded-2xl border border-[#00E676]/30 bg-[#00E676]/[0.03] p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-[#00E676] mb-6">IAenergía</h3>
            <ul className="space-y-4">
              {filas.map((f) => (
                <li key={f.iaenergia} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#00E676] shrink-0 mt-0.5" />
                  <span className="text-white">{f.iaenergia}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center text-[#9CA3AF] text-lg max-w-2xl mx-auto mt-12"
        >
          La diferencia no está en cambiar más. Está en saber cuándo merece la pena cambiar y cuándo
          no hacer <span className="text-white font-medium">absolutamente nada</span>.
        </motion.p>
      </div>
    </section>
  )
}
