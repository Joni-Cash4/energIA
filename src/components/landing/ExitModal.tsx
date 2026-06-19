'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export function ExitModal() {
  const [visible, setVisible] = useState(false)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('exit_modal_shown')) return

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 10) {
        setVisible(true)
        sessionStorage.setItem('exit_modal_shown', '1')
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('mouseleave', handleMouseLeave)
    }, 5000)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre || !telefono) return
    setEnviando(true)
    try {
      await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          telefono,
          mensaje: 'Contacto desde modal de salida',
          email: '',
        }),
      })
      setEnviado(true)
    } catch {
      setEnviado(true)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm"
            onClick={() => setVisible(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed z-50 inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-[#111111] border border-[#2A2A2A] rounded-2xl p-8 shadow-2xl"
          >
            <button
              onClick={() => setVisible(false)}
              className="absolute top-4 right-4 text-[#6B7280] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {!enviado ? (
              <>
                <div className="mb-6">
                  <p className="text-[#00E676] text-xs uppercase tracking-widest mb-2">
                    Antes de irte
                  </p>
                  <h2 className="text-2xl font-bold text-white leading-snug">
                    ¿Sabes cuánto estás pagando de más?
                  </h2>
                  <p className="text-[#9CA3AF] text-sm mt-3">
                    Déjanos tu número y te hacemos un análisis gratuito de tu factura eléctrica — sin compromiso.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <input
                    type="text"
                    placeholder="Tu nombre"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    required
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white placeholder-[#4B5563] text-sm focus:outline-none focus:border-[#00E676] transition-colors"
                  />
                  <input
                    type="tel"
                    placeholder="Tu teléfono"
                    value={telefono}
                    onChange={e => setTelefono(e.target.value)}
                    required
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white placeholder-[#4B5563] text-sm focus:outline-none focus:border-[#00E676] transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={enviando}
                    className="w-full bg-[#00E676] text-black font-semibold py-3 rounded-xl hover:bg-[#00C853] transition-colors disabled:opacity-50 text-sm"
                  >
                    {enviando ? 'Enviando...' : 'Quiero el análisis gratuito'}
                  </button>
                  <p className="text-[#4B5563] text-xs text-center">
                    Sin compromiso. Te contactamos en menos de 24h.
                  </p>
                </form>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="text-4xl mb-4">✓</div>
                <h3 className="text-white font-bold text-xl mb-2">¡Perfecto, {nombre}!</h3>
                <p className="text-[#9CA3AF] text-sm">
                  Te contactamos en las próximas horas para analizar tu factura.
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
