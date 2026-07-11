'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'

import { FAQ_ITEMS } from '@/lib/faq-items'

export { FAQ_ITEMS }

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
