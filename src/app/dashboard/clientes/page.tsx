'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Search, Plus, ChevronRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getSupabaseClient } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import type { Cliente, ClienteEstado } from '@/types'

const ESTADO_CONFIG: Record<ClienteEstado, { label: string; variant: 'default' | 'blue' | 'yellow' | 'red' | 'secondary' | 'purple' }> = {
  prospecto: { label: 'Prospecto',  variant: 'secondary' },
  reunion:   { label: 'Reunión',    variant: 'blue' },
  oferta:    { label: 'Oferta',     variant: 'yellow' },
  firmado:   { label: 'Firmado',    variant: 'default' },
  perdido:   { label: 'Perdido',    variant: 'red' },
}

type TabFiltro = 'todos' | 'revision'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<string>('all')
  const [tab, setTab] = useState<TabFiltro>('todos')

  useEffect(() => {
    const supabase = getSupabaseClient()
    supabase.from('clientes').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setClientes(data ?? []); setLoading(false) })
  }, [])

  const paraRevision = clientes.filter((c) => c.revision_pendiente)

  const filtered = clientes.filter((c) => {
    const matchTab = tab === 'todos' || c.revision_pendiente
    const matchSearch = !search || [c.nombre, c.empresa, c.email, c.cups].some(
      (v) => v?.toLowerCase().includes(search.toLowerCase())
    )
    const matchEstado = estadoFilter === 'all' || c.estado === estadoFilter
    return matchTab && matchSearch && matchEstado
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Clientes</h1>
        <Link href="/dashboard/nueva-factura">
          <Button className="gap-2"><Plus className="w-4 h-4" />Nuevo cliente</Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#1F1F1F]">
        <button
          onClick={() => setTab('todos')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'todos'
              ? 'border-[#00E676] text-white'
              : 'border-transparent text-[#6B7280] hover:text-[#9CA3AF]'
          }`}
        >
          Todos ({clientes.length})
        </button>
        <button
          onClick={() => setTab('revision')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'revision'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-[#6B7280] hover:text-[#9CA3AF]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Para revisión
          {paraRevision.length > 0 && (
            <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
              tab === 'revision' ? 'bg-amber-400/20 text-amber-400' : 'bg-[#2A2A2A] text-[#9CA3AF]'
            }`}>
              {paraRevision.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'revision' && (
        <div className="mb-4 flex items-start gap-3 p-4 rounded-xl bg-amber-400/5 border border-amber-400/20 text-amber-300 text-sm">
          <Clock className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Clientes sin contrato registrado o con contrato vencido hace más de 1 año</p>
            <p className="text-amber-300/60 text-xs mt-0.5">Entra en cada cliente, registra su contrato actual y márcalo como atendido.</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, email, CUPS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={estadoFilter} onValueChange={setEstadoFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
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
              {clientes.length === 0
                ? 'Aún no tienes clientes. Procesa una factura para empezar.'
                : 'No se encontraron clientes con esos filtros.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1F1F1F]">
                    {['Nombre', 'Empresa', 'CUPS', 'Comercializadora', 'Estado', 'Creado', ''].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => {
                    const est = ESTADO_CONFIG[c.estado]
                    return (
                      <motion.tr
                        key={c.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-[#1F1F1F] last:border-0 hover:bg-[#1A1A1A] transition-colors"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{c.nombre}</span>
                            {c.revision_pendiente && (
                              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-label="Pendiente de revisión" />
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[#9CA3AF] text-sm">{c.empresa ?? '—'}</td>
                        <td className="px-5 py-4 font-mono text-xs text-[#9CA3AF]">{c.cups?.slice(0, 14) ?? '—'}</td>
                        <td className="px-5 py-4 text-[#9CA3AF] text-sm">{c.comercializadora ?? '—'}</td>
                        <td className="px-5 py-4">
                          <Badge variant={est.variant}>{est.label}</Badge>
                        </td>
                        <td className="px-5 py-4 text-[#6B7280] text-sm">{formatDate(c.created_at)}</td>
                        <td className="px-5 py-4">
                          <Link href={`/dashboard/clientes/${c.id}`} className="text-[#6B7280] hover:text-[#00E676] transition-colors">
                            <ChevronRight className="w-4 h-4" />
                          </Link>
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
