'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sendReport } from '@/lib/api'
import type { InvoiceAnalysis } from '@/types'

interface Props {
  invoiceData: InvoiceAnalysis
}

export function Step3Form({ invoiceData }: Props) {
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', empresa: '' })
  const [privacidad, setPrivacidad] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!privacidad) { setError('Debes aceptar la política de privacidad'); return }
    setError(null)
    setLoading(true)
    try {
      await sendReport({ ...form, invoice_data: invoiceData })
      setDone(true)
    } catch {
      setError('Ha ocurrido un error. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  return (
    <div className="max-w-md mx-auto">
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <div className="w-20 h-20 rounded-full bg-[#00E676]/15 border-2 border-[#00E676]/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-[#00E676]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">¡Informe enviado!</h2>
            <p className="text-[#9CA3AF] mb-2">
              Hemos enviado tu informe personalizado a:
            </p>
            <p className="text-white font-semibold text-lg mb-6">{form.email}</p>
            <p className="text-[#6B7280] text-sm">
              Revisa también tu carpeta de spam. Nuestro equipo se pondrá en contacto
              contigo en las próximas 24 horas.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-[#00E676]" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Recibe tu informe gratis</h2>
              <p className="text-[#9CA3AF] text-sm">
                Completa el formulario y te enviamos el análisis completo a tu email
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-1.5">Nombre *</label>
                <Input
                  value={form.nombre}
                  onChange={set('nombre')}
                  placeholder="Tu nombre completo"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-1.5">Email *</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="tu@empresa.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-1.5">Teléfono</label>
                <Input
                  type="tel"
                  value={form.telefono}
                  onChange={set('telefono')}
                  placeholder="+34 600 000 000"
                />
              </div>
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-1.5">Empresa (opcional)</label>
                <Input
                  value={form.empresa}
                  onChange={set('empresa')}
                  placeholder="Nombre de tu empresa"
                />
              </div>

              {/* Privacy */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  onClick={() => setPrivacidad(!privacidad)}
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    privacidad ? 'bg-[#00E676] border-[#00E676]' : 'border-[#3A3A3A] hover:border-[#00E676]/50'
                  }`}
                >
                  {privacidad && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
                </div>
                <span className="text-sm text-[#9CA3AF] leading-relaxed">
                  Acepto la{' '}
                  <a href="#" className="text-[#00E676] hover:underline">
                    política de privacidad
                  </a>{' '}
                  y el tratamiento de mis datos para recibir el informe y comunicaciones comerciales.
                </span>
              </label>

              {error && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" disabled={loading} className="w-full mt-2">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Recibir informe gratuito'
                )}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
