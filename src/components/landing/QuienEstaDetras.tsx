'use client'
import Image from 'next/image'
import { motion } from 'framer-motion'

const parrafos = [
  'Desde 2014 ayudo a empresas a entender, optimizar y controlar su energía. Durante este tiempo he visto una realidad que se repite una y otra vez: la mayoría de empresas solo reciben una llamada cuando toca renovar el contrato. El resto del año, nadie vuelve a mirar su energía.',
  'Revisar cada día el consumo, las facturas y el mercado de todos los clientes es imposible de hacer a mano. Por eso nació IAenergía: para que la tecnología se encargue del seguimiento continuo y yo pueda dedicar mi tiempo a lo que realmente aporta valor: explicarte lo que hemos encontrado, resolver tus dudas y ayudarte a tomar la mejor decisión.',
]

export function QuienEstaDetras() {
  return (
    <section className="py-24 bg-[#0D0D0D] border-y border-[#1F1F1F]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-[minmax(0,280px)_1fr] gap-10 md:gap-14 items-start">
          {/* Foto */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative mx-auto md:mx-0 w-56 md:w-full max-w-[280px]"
          >
            <div className="absolute -inset-2 bg-[#00E676]/10 rounded-full blur-2xl pointer-events-none" />
            <Image
              src="/asesor/Foto perfil.png"
              alt="Jonathan, asesor energético y fundador de IAenergía"
              width={300}
              height={300}
              className="relative rounded-full object-cover w-full aspect-square border border-[#00E676]/20"
            />
          </motion.div>

          {/* Texto */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <p className="text-[#00E676] text-sm uppercase tracking-widest mb-3">Quién está detrás</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">
              Hola, soy Jonathan. Soy asesor energético y estoy detrás de IAenergía.
            </h2>
            <div className="space-y-5">
              {parrafos.map((p, i) => (
                <p key={i} className="text-[#9CA3AF] text-lg leading-relaxed">
                  {p}
                </p>
              ))}
              <p className="text-white text-lg font-medium">
                Si has llegado hasta aquí, probablemente nos hayamos conocido hace poco. Si te queda
                alguna duda, escríbeme y lo vemos con calma.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
