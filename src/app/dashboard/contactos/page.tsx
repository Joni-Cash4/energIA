'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getSupabaseClient } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/lib/use-toast'
import type { Contacto } from '@/types'

export default function ContactosPage() {
  const { toast } = useToast()
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState<string | null>(null)

  const load = async () => {
    const { data } = await getSupabaseClient()
      .from('contactos')
      .select('*')
      .order('created_at', { ascending: false })
    setContactos(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleMarcarLeido = async (id: string) => {
    setMarking(id)
    const { error } = await getSupabaseClient().from('contactos').update({ leido: true }).eq('id', id)
    if (error) {
      toast({ title: 'Error al actualizar', variant: 'destructive' })
    } else {
      setContactos((p) => p.map((c) => c.id === id ? { ...c, leido: true } : c))
      toast({ title: 'Marcado como leído' })
    }
    setMarking(null)
  }

  const sinLeer = contactos.filter((c) => !c.leido).length

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Mensajes de contacto</h1>
          <p className="text-[#6B7280] text-sm mt-1">Formulario web de iaenergia.es/contacto</p>
        </div>
        {sinLeer > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-red-400 font-semibold">{sinLeer}</span>
            <span className="text-red-400/70 text-sm">sin leer</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 rounded-full border-2 border-[#00E676]/30 border-t-[#00E676] animate-spin" />
        </div>
      ) : contactos.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-[#141414] border border-[#1F1F1F] flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-[#6B7280]" />
          </div>
          <p className="text-[#6B7280]">No hay mensajes todavía.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {contactos.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`bg-[#141414] border rounded-2xl p-6 transition-colors ${
                !c.leido ? 'border-[#00E676]/25' : 'border-[#1F1F1F]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${!c.leido ? 'bg-[#00E676]/10' : 'bg-[#1F1F1F]'}`}>
                    <Mail className={`w-5 h-5 ${!c.leido ? 'text-[#00E676]' : 'text-[#6B7280]'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-semibold">{c.nombre}</span>
                      {!c.leido && <Badge variant="default">Nuevo</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-sm text-[#9CA3AF]">
                      <a href={`mailto:${c.email}`} className="hover:text-[#00E676] transition-colors">{c.email}</a>
                      {c.telefono && <span>{c.telefono}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[#6B7280] text-xs">{formatDate(c.created_at)}</span>
                  {!c.leido && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleMarcarLeido(c.id)}
                      disabled={marking === c.id}
                      className="gap-1.5"
                    >
                      {marking === c.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <CheckCircle2 className="w-3.5 h-3.5" />
                      }
                      Marcar leído
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-[#9CA3AF] text-sm leading-relaxed bg-[#0F0F0F] rounded-xl px-4 py-3 border border-[#1A1A1A]">
                {c.mensaje}
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
