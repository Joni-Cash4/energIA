'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Loader2, Mail, Phone, MapPin } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Toaster } from '@/components/ui/toaster'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function ContactoPage() {
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', mensaje: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setDone(true)
    } catch {
      setError('Ha ocurrido un error. Escríbenos directamente a contacto@iaenergia.es')
    }
    setLoading(false)
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-16 pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-14">
            <p className="text-[#00E676] text-sm uppercase tracking-widest mb-3">Contacto</p>
            <h1 className="text-4xl font-bold text-white mb-4">Hablemos</h1>
            <p className="text-[#9CA3AF] text-lg max-w-xl mx-auto">
              ¿Tienes dudas? ¿Quieres que analicemos tu caso?
              Escríbenos y te respondemos en menos de 24 horas.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-10">
            {/* Form */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <AnimatePresence mode="wait">
                {done ? (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center text-center py-16"
                  >
                    <div className="w-20 h-20 rounded-full bg-[#00E676]/15 border-2 border-[#00E676]/30 flex items-center justify-center mb-6">
                      <CheckCircle2 className="w-10 h-10 text-[#00E676]" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">¡Mensaje recibido!</h2>
                    <p className="text-[#9CA3AF]">
                      Te responderemos a <strong className="text-white">{form.email}</strong> en menos de 24 horas.
                    </p>
                  </motion.div>
                ) : (
                  <motion.form key="form" onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-[#9CA3AF] mb-2">Nombre *</label>
                        <Input value={form.nombre} onChange={set('nombre')} placeholder="Tu nombre" required />
                      </div>
                      <div>
                        <label className="block text-sm text-[#9CA3AF] mb-2">Teléfono</label>
                        <Input value={form.telefono} onChange={set('telefono')} placeholder="+34 600 000 000" type="tel" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-[#9CA3AF] mb-2">Email *</label>
                      <Input value={form.email} onChange={set('email')} placeholder="tu@empresa.com" type="email" required />
                    </div>
                    <div>
                      <label className="block text-sm text-[#9CA3AF] mb-2">Mensaje *</label>
                      <textarea
                        value={form.mensaje}
                        onChange={set('mensaje')}
                        rows={5}
                        required
                        placeholder="Cuéntanos en qué podemos ayudarte..."
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] px-3 py-2 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#00E676] resize-none"
                      />
                    </div>
                    {error && (
                      <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>
                    )}
                    <Button type="submit" size="lg" disabled={loading} className="gap-2">
                      {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando...</> : 'Enviar mensaje'}
                    </Button>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              {[
                { icon: Mail, label: 'Email', value: 'contacto@iaenergia.es', href: 'mailto:contacto@iaenergia.es' },
              ].map(({ icon: Icon, label, value, href }) => (
                <div key={label} className="flex items-start gap-4 p-5 bg-[#141414] border border-[#1F1F1F] rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-[#00E676]/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#00E676]" />
                  </div>
                  <div>
                    <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-0.5">{label}</p>
                    <a href={href} className="text-white hover:text-[#00E676] transition-colors font-medium">{value}</a>
                  </div>
                </div>
              ))}

              <div className="p-5 bg-[#141414] border border-[#1F1F1F] rounded-xl">
                <h3 className="text-white font-semibold mb-3">Horario de atención</h3>
                <div className="space-y-1.5 text-sm text-[#9CA3AF]">
                  <div className="flex justify-between">
                    <span>Lunes — Viernes</span>
                    <span className="text-white">9:00 — 18:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sábado — Domingo</span>
                    <span className="text-[#6B7280]">Cerrado</span>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-[#00E676]/5 border border-[#00E676]/20 rounded-xl">
                <p className="text-[#00E676] text-sm font-medium mb-1">Respuesta garantizada</p>
                <p className="text-[#9CA3AF] text-sm">
                  Respondemos todos los mensajes en menos de 24 horas laborables.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
      <Toaster />
    </>
  )
}
