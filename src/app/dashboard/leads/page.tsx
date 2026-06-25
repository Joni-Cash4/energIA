'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, UserPlus, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getSupabaseClient } from '@/lib/supabase'
import { formatDate, formatCurrency } from '@/lib/utils'
import { useToast } from '@/lib/use-toast'
import type { Lead, LeadEstado } from '@/types'

const ESTADO_CONFIG: Record<LeadEstado, { label: string; variant: 'default' | 'blue' | 'yellow' | 'secondary' | 'red' | 'purple' }> = {
  nuevo:       { label: 'Nuevo',       variant: 'default' },
  contactado:  { label: 'Contactado',  variant: 'blue' },
  convertido:  { label: 'Convertido',  variant: 'purple' },
  descartado:  { label: 'Descartado',  variant: 'red' },
}

export default function LeadsPage() {
  const { toast } = useToast()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<string>('all')
  const [converting, setConverting] = useState<string | null>(null)

  const load = () => {
    const supabase = getSupabaseClient()
    supabase.from('leads').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setLeads(data ?? []); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const handleConvert = async (lead: Lead) => {
    setConverting(lead.id)
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('clientes').insert({
      nombre: lead.nombre,
      email: lead.email,
      telefono: lead.telefono,
      empresa: lead.empresa,
      cups: lead.cups,
      comercializadora: lead.comercializadora,
      tarifa: lead.tarifa,
      estado: 'prospecto',
      user_id: user?.id,
    })
    if (!error) {
      await supabase.from('leads').update({ estado: 'convertido' }).eq('id', lead.id)
      toast({ title: 'Lead convertido a cliente correctamente' })
      load()
    } else {
      toast({ title: 'Error al convertir el lead', variant: 'destructive' })
    }
    setConverting(null)
  }

  const filtered = leads.filter((l) => {
    const matchSearch = !search || [l.nombre, l.email, l.telefono, l.cups].some(
      (v) => v?.toLowerCase().includes(search.toLowerCase())
    )
    const matchEstado = estadoFilter === 'all' || l.estado === estadoFilter
    return matchSearch && matchEstado
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-[#6B7280] text-sm mt-1">Contactos del comparador público</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <Input className="pl-9" placeholder="Buscar por nombre, email, CUPS..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={estadoFilter} onValueChange={setEstadoFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(ESTADO_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 rounded-full border-2 border-[#00E676]/30 border-t-[#00E676] animate-spin" />
        </div>
      ) : (
        <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-[#6B7280]">
              {leads.length === 0 ? 'No hay leads todavía. Los leads llegan cuando alguien usa el comparador público.' : 'No se encontraron leads.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1F1F1F]">
                    {['Nombre', 'Email', 'Teléfono', 'CUPS', 'Ahorro estimado', 'Fecha', 'Estado', ''].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l, i) => {
                    const est = ESTADO_CONFIG[l.estado]
                    return (
                      <motion.tr
                        key={l.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-[#1F1F1F] last:border-0 hover:bg-[#1A1A1A] transition-colors"
                      >
                        <td className="px-5 py-4 text-white font-medium">{l.nombre}</td>
                        <td className="px-5 py-4 text-[#9CA3AF]">{l.email}</td>
                        <td className="px-5 py-4 text-[#9CA3AF]">{l.telefono ?? '—'}</td>
                        <td className="px-5 py-4 font-mono text-xs text-[#9CA3AF]">{l.cups?.slice(0, 14) ?? '—'}</td>
                        <td className="px-5 py-4 text-[#00E676] font-semibold">
                          {l.ahorro_estimado_anual ? formatCurrency(l.ahorro_estimado_anual, 0) : '—'}
                        </td>
                        <td className="px-5 py-4 text-[#6B7280]">{formatDate(l.created_at)}</td>
                        <td className="px-5 py-4">
                          <Badge variant={est.variant}>{est.label}</Badge>
                        </td>
                        <td className="px-5 py-4">
                          {l.estado !== 'convertido' && l.estado !== 'descartado' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleConvert(l)}
                              disabled={converting === l.id}
                              className="gap-1.5 text-xs"
                            >
                              {converting === l.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <UserPlus className="w-3 h-3" />
                              }
                              Convertir
                            </Button>
                          )}
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
