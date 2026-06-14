'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Search, Plus, ChevronRight } from 'lucide-react'
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

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<string>('all')

  useEffect(() => {
    const supabase = getSupabaseClient()
    supabase.from('clientes').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setClientes(data ?? []); setLoading(false) })
  }, [])

  const filtered = clientes.filter((c) => {
    const matchSearch = !search || [c.nombre, c.empresa, c.email, c.cups].some(
      (v) => v?.toLowerCase().includes(search.toLowerCase())
    )
    const matchEstado = estadoFilter === 'all' || c.estado === estadoFilter
    return matchSearch && matchEstado
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Clientes</h1>
        <Link href="/dashboard/nueva-factura">
          <Button className="gap-2"><Plus className="w-4 h-4" />Nuevo cliente</Button>
        </Link>
      </div>

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
              {clientes.length === 0 ? 'Aún no tienes clientes. Procesa una factura para empezar.' : 'No se encontraron clientes con esos filtros.'}
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
                        <td className="px-5 py-4 text-white font-medium">{c.nombre}</td>
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
