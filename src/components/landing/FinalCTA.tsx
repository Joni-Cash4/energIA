'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Upload, CalendarCheck, MessageCircle } from 'lucide-react'

const WHATSAPP_REVISION =
  'https://wa.me/34689880596?text=' +
  encodeURIComponent(
    'Hola Jonathan, me gustaría solicitar una revisión gratuita de la energía de mi empresa.'
  )
import { Button } from '@/components/ui/button'

export function FinalCTA() {
  return (
    <section id="empieza" className="py-24 scroll-mt-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Empieza aquí</h2>
          <p className="text-[#9CA3AF] text-lg max-w-2xl mx-auto">
            Gestionar bien la energía de una empresa no consiste en cambiar de contrato. Consiste en
            tomar la decisión adecuada cuando realmente llega el momento. Hay dos formas de empezar,
            y ninguna te compromete a nada.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Sube tu factura */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-col bg-[#141414] border border-[#1F1F1F] rounded-2xl p-8 hover:border-[#00E676]/30 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center mb-5">
              <Upload className="w-6 h-6 text-[#00E676]" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Sube tu factura</h3>
            <p className="text-[#9CA3AF] leading-relaxed mb-6 flex-1">
              Sube una factura y obtendrás al momento una primera revisión con tus datos reales. Es la
              forma más rápida de empezar a conocer tu caso.
            </p>
            <Link href="/comparador">
              <Button className="w-full gap-2">
                <Upload className="w-4 h-4" />
                Subir factura
              </Button>
            </Link>
          </motion.div>

          {/* Solicita revisión gratuita */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col bg-[#141414] border border-[#00E676]/20 rounded-2xl p-8 relative overflow-hidden"
          >
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#00E676]/50 to-transparent" />
            <div className="w-12 h-12 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center mb-5">
              <CalendarCheck className="w-6 h-6 text-[#00E676]" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Solicita una revisión gratuita</h3>
            <p className="text-[#9CA3AF] leading-relaxed mb-6 flex-1">
              Escríbenos por WhatsApp y cuadramos una revisión. Analizamos tu situación, revisamos
              tus contratos y te explicamos personalmente lo que hemos encontrado. Si creemos que ya
              tienes el mejor contrato posible, también te lo diremos.
            </p>
            <a href={WHATSAPP_REVISION} target="_blank" rel="noopener noreferrer">
              <Button className="w-full gap-2 glow-green">
                <MessageCircle className="w-4 h-4" />
                Escríbenos por WhatsApp
              </Button>
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
