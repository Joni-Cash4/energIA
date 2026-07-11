'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FinalCTA() {
  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden bg-[#141414] border border-[#00E676]/20 rounded-3xl p-12 text-center"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#00E676]/5 to-[#1565C0]/5 pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-1 bg-gradient-to-r from-transparent via-[#00E676] to-transparent" />

          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-[#00E676] flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(0,230,118,0.3)]">
              <Zap className="w-8 h-8 text-black fill-black" />
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              ¿Listo para ahorrar?
            </h2>
            <p className="text-[#9CA3AF] text-lg mb-8 max-w-xl mx-auto">
              Miles de empresas ya han reducido su factura eléctrica con IAenergía.
              Únete gratis y descubre tu ahorro en segundos.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/comparador">
                <Button size="xl" className="gap-2 glow-green">
                  Analiza tu factura gratis
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/noticias">
                <Button variant="secondary" size="xl">
                  Ver últimas noticias
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
