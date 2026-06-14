'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, CheckCircle2, Loader2, Phone } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getSupabaseClient } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/lib/use-toast'
import type { Cliente } from '@/types'

export default function AgendaPage() {
  const { toast } = useToast()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState<string | null>(null)

  const load = async () => {
    const supabase = getSupabaseClient()
    const hoy = new Date()
    const en7 = new Date(); en7.setDate(en7.getDate() + 7)

    const { data } = await supabase
      .from('clientes')
      .select('*')
      .not('proximo_contacto', 'is', null)
      .lte('proximo_contacto', en7.toISOString().split('T')[0])
      .order('proximo_contacto')

    setClientes(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleMarcar = async (id: string) => {
    setMarking(id)
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('clientes')
      .update({ proximo_contacto: null })
      .eq('id', id)

    if (error) {
      toast({ title: 'Error al actualizar', variant: 'destructive' })
    } else {
      toast({ title: 'Marcado como contactado' })
      setClientes((p) => p.filter((c) => c.id !== id))
    }
    setMarking(null)
  }

  const hoy = new Date().toISOString().split('T')[0]
  const vencidos  = clientes.filter((c) => c.proximo_contacto! < hoy)
  const proximos  = clientes.filter((c) => c.proximo_contacto! >= hoy)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Agenda</h1>
          <p className="text-[#6B7280] text-sm mt-1">Clientes pendientes de contactar esta semana</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[#141414] border border-[#1F1F1F] rounded-xl">
          <CalendarDays className="w-4 h-4 text-[#00E676]" />
          <span className="text-white font-semibold">{clientes.length}</span>
          <span className="text-[#6B7280] text-sm">pendientes</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 rounded-full border-2 border-[#00E676]/30 border-t-[#00E676] animate-spin" />
        </div>
      ) : clientes.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center py-20 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-[#00E676]/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-[#00E676]" />
          </div>
          <h2 className="text-white font-semibold mb-2">¡Todo al día!</h2>
          <p className="text-[#6B7280] text-sm max-w-xs">
            No tienes clientes pendientes de contactar esta semana.
            Añade una fecha de próximo contacto en la ficha de cada cliente.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-8">
          {/* Vencidos */}
          {vencidos.length > 0 && (
            <div>
              <h2 className="text-red-400 text-sm font-medium uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                Vencidos ({vencidos.length})
              </h2>
              <div className="space-y-3">
                {vencidos.map((c, i) => (
                  <ClienteCard key={c.id} cliente={c} i={i} marking={marking} onMarcar={handleMarcar} overdue />
                ))}
              </div>
            </div>
          )}

          {/* Próximos 7 días */}
          {proximos.length > 0 && (
            <div>
              <h2 className="text-[#9CA3AF] text-sm font-medium uppercase tracking-wide mb-3">
                Próximos 7 días ({proximos.length})
              </h2>
              <div className="space-y-3">
                {proximos.map((c, i) => (
                  <ClienteCard key={c.id} cliente={c} i={i} marking={marking} onMarcar={handleMarcar} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ClienteCard({ cliente: c, i, marking, onMarcar, overdue }: {
  cliente: Cliente; i: number; marking: string | null
  onMarcar: (id: string) => void; overdue?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className={`flex items-center justify-between gap-4 p-5 bg-[#141414] border rounded-xl ${
        overdue ? 'border-red-500/30' : 'border-[#1F1F1F]'
      }`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${overdue ? 'bg-red-500/15' : 'bg-[#00E676]/10'}`}>
          <Phone className={`w-4 h-4 ${overdue ? 'text-red-400' : 'text-[#00E676]'}`} />
        </div>
        <div className="min-w-0">
          <Link href={`/dashboard/clientes/${c.id}`} className="text-white font-medium hover:text-[#00E676] transition-colors">
            {c.nombre}
          </Link>
          {c.empresa && <p className="text-[#9CA3AF] text-xs">{c.empresa}</p>}
          <p className={`text-xs mt-0.5 ${overdue ? 'text-red-400' : 'text-[#6B7280]'}`}>
            {overdue ? '⚠ Vencido · ' : ''}
            {c.proximo_contacto ? formatDate(c.proximo_contacto) : '—'}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onMarcar(c.id)}
        disabled={marking === c.id}
        className="gap-1.5 shrink-0"
      >
        {marking === c.id
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <CheckCircle2 className="w-3.5 h-3.5" />
        }
        Contactado
      </Button>
    </motion.div>
  )
}
