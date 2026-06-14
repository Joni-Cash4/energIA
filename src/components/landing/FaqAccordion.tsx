'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'

export const FAQ_ITEMS = [
  {
    q: '¿Tengo penalización si cambio de comercializadora?',
    a: 'Depende de tu contrato actual. Algunas comercializadoras incluyen cláusulas de permanencia o penalización por baja anticipada, especialmente en contratos con precio fijo a largo plazo. Antes de hacer ningún cambio, revisamos tu contrato contigo para evitar cualquier sorpresa. En muchos casos el cambio es gratuito, pero no siempre.',
  },
  {
    q: '¿Cuánto tiempo tarda el proceso de cambio?',
    a: 'La ley establece un plazo máximo de 10 días hábiles. Durante este periodo seguirás teniendo luz en todo momento — el cambio es puramente administrativo. La nueva comercializadora se encarga de cancelar tu contrato anterior y notificar a la distribuidora, sin que tengas que hacer nada. El proceso es totalmente gratuito. Recibirás una última factura de tu antigua compañía por el consumo hasta el día del cambio.',
  },
  {
    q: '¿La tarifa indexada es siempre más barata?',
    a: 'No siempre. Con la tarifa indexada pagas el precio real del mercado OMIE cada mes, lo que significa que en meses de precios altos tu factura puede ser mayor que con una tarifa fija. La ventaja es que también bajas cuando el mercado baja, y a largo plazo suele resultar más económica. Analizamos tu caso concreto para recomendarte la opción que más te conviene.',
  },
  {
    q: '¿Qué diferencia hay entre tarifa fija e indexada?',
    a: 'En la tarifa fija pagas siempre el mismo precio por kWh, independientemente del mercado — cómodo, pero incluye un margen de riesgo de la comercializadora. En la tarifa indexada pagas el precio real del mercado OMIE ese mes más un fee transparente. Es más variable pero más honesta y habitualmente más barata a largo plazo.',
  },
  {
    q: '¿Qué es IAenergía? ¿Sois una comercializadora?',
    a: 'No. IAenergía es un servicio de asesoría energética independiente. No vendemos electricidad ni somos una comercializadora. Analizamos tu consumo, comparamos opciones del mercado y te acompañamos en el proceso de cambio.',
  },
  {
    q: '¿Qué es el CUPS?',
    a: 'El CUPS (Código Unificado de Punto de Suministro) es el identificador único de tu punto de conexión a la red eléctrica, como el DNI de tu instalación. Empieza por ES y tiene 20 caracteres. Lo encuentras en cualquier factura eléctrica.',
  },
]

interface Props {
  items?: typeof FAQ_ITEMS
  showLink?: boolean
}

export function FaqAccordion({ items = FAQ_ITEMS, showLink = true }: Props) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="py-24 bg-[#0D0D0D] border-t border-[#1F1F1F]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-[#00E676] text-sm uppercase tracking-widest mb-3">Preguntas frecuentes</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">¿Tienes dudas?</h2>
        </motion.div>

        <div className="flex flex-col divide-y divide-[#1F1F1F] border border-[#1F1F1F] rounded-2xl overflow-hidden">
          {items.map((item, i) => (
            <div key={i} className="bg-[#141414]">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left text-white hover:bg-[#1A1A1A] transition-colors"
              >
                <span className="font-medium text-sm sm:text-base">{item.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-[#6B7280] shrink-0 transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    key="content"
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-[#9CA3AF] text-sm leading-relaxed">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {showLink && (
          <div className="mt-8 text-center">
            <Link href="/faq" className="text-[#00E676] text-sm hover:underline">
              Ver todas las preguntas frecuentes →
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
