'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('cookie_consent')) {
      setVisible(true)
    }
  }, [])

  function accept() {
    localStorage.setItem('cookie_consent', 'accepted')
    setVisible(false)
  }

  function reject() {
    localStorage.setItem('cookie_consent', 'rejected')
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-0 inset-x-0 z-50 p-4"
        >
          <div className="max-w-4xl mx-auto bg-[#111111] border border-[#2A2A2A] rounded-2xl px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-2xl">
            <p className="text-[#9CA3AF] text-sm flex-1">
              Usamos cookies propias para mejorar tu experiencia. Puedes aceptarlas, rechazarlas o consultar nuestra{' '}
              <Link href="/privacidad" className="text-[#00E676] hover:underline">
                política de privacidad
              </Link>
              .
            </p>
            <div className="flex gap-3 shrink-0">
              <button
                onClick={reject}
                className="px-4 py-2 text-sm text-[#6B7280] hover:text-white border border-[#2A2A2A] rounded-xl transition-colors"
              >
                Rechazar
              </button>
              <button
                onClick={accept}
                className="px-4 py-2 text-sm font-semibold bg-[#00E676] text-black rounded-xl hover:bg-[#00C853] transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
