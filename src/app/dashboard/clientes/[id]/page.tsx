'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, Save, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getSupabaseClient } from '@/lib/supabase'
import { formatDate, formatCurrency } from '@/lib/utils'
import { useToast } from '@/lib/use-toast'
import type { Cliente, Factura, ClienteEstado } from '@/types'

const ESTADOS: { value: ClienteEstado; label: string }[] = [
  { value: 'prospecto', label: 'Prospecto' },
  { value: 'reunion',   label: 'Reunión' },
  { value: 'oferta',    label: 'Oferta' },
  { value: 'firmado',   label: 'Firmado' },
  { value: 'perdido',   label: 'Perdido' },
]

const ESTADO_VARIANT: Record<ClienteEstado, 'default' | 'blue' | 'yellow' | 'red' | 'secondary' | 'purple'> = {
  prospecto: 'secondary', reunion: 'blue', oferta: 'yellow', firmado: 'default', perdido: 'red',
}

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editable fields
  const [estado,               setEstado]               = useState<ClienteEstado>('prospecto')
  const [notas,                setNotas]                = useState('')
  const [feeEnergia,           setFeeEnergia]           = useState('')
  const [feePotencia,          setFeePotencia]          = useState('')
  const [kwhAnuales,           setKwhAnuales]           = useState('')
  const [kwContratados,        setKwContratados]        = useState('')
  const [proximoContacto,      setProximoContacto]      = useState('')
  const [fechaInicioContrato,  setFechaInicioContrato]  = useState('')

  useEffect(() => {
    const supabase = getSupabaseClient()
    Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase.from('facturas').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
    ]).then(([{ data: c }, { data: f }]) => {
      if (!c) { router.replace('/dashboard/clientes'); return }
      setCliente(c)
      setEstado(c.estado)
      setNotas(c.notas ?? '')
      setFeeEnergia(String(c.fee_energia ?? ''))
      setFeePotencia(String(c.fee_potencia ?? ''))
      setKwhAnuales(String(c.kwh_anuales ?? ''))
      setKwContratados(String(c.kw_contratados ?? ''))
      setProximoContacto(c.proximo_contacto ?? '')
      setFechaInicioContrato(c.fecha_inicio_contrato ?? '')
      setFacturas(f ?? [])
      setLoading(false)
    })
  }, [id, router])

  const handleSave = async () => {
    setSaving(true)
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('clientes').update({
      estado,
      notas,
      fee_energia:           feeEnergia ? Number(feeEnergia) : null,
      fee_potencia:          feePotencia ? Number(feePotencia) : null,
      kwh_anuales:           kwhAnuales ? Number(kwhAnuales) : null,
      kw_contratados:        kwContratados ? Number(kwContratados) : null,
      proximo_contacto:      proximoContacto || null,
      fecha_inicio_contrato: fechaInicioContrato || null,
    }).eq('id', id)

    if (error) toast({ title: 'Error al guardar', variant: 'destructive' })
    else { toast({ title: 'Cambios guardados' }); setCliente((p) => p ? { ...p, estado, notas } : p) }
    setSaving(false)
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-7 h-7 rounded-full border-2 border-[#00E676]/30 border-t-[#00E676] animate-spin" />
    </div>
  )
  if (!cliente) return null

  return (
    <div>
      <Link href="/dashboard/clientes" className="inline-flex items-center gap-2 text-[#6B7280] hover:text-white transition-colors text-sm mb-6">
        <ArrowLeft className="w-4 h-4" />Volver a clientes
      </Link>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex-1 space-y-6">
          {/* Header card */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h1 className="text-2xl font-bold text-white">{cliente.nombre}</h1>
                {cliente.empresa && <p className="text-[#9CA3AF] mt-1">{cliente.empresa}</p>}
              </div>
              <Badge variant={ESTADO_VARIANT[cliente.estado]}>{ESTADOS.find(e => e.value === cliente.estado)?.label}</Badge>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Email',            value: cliente.email },
                { label: 'Teléfono',         value: cliente.telefono },
                { label: 'CUPS',             value: cliente.cups, mono: true },
                { label: 'Comercializadora', value: cliente.comercializadora },
                { label: 'Tarifa',           value: cliente.tarifa },
                { label: 'Alta',             value: formatDate(cliente.created_at) },
              ].filter(({ value }) => value).map(({ label, value, mono }) => (
                <div key={label}>
                  <p className="text-[#6B7280] text-xs mb-0.5">{label}</p>
                  <p className={`text-white ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Facturas */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1F1F1F] flex items-center justify-between">
              <h2 className="text-white font-semibold">Historial de facturas</h2>
              <Link href="/dashboard/nueva-factura">
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" />Nueva
                </Button>
              </Link>
            </div>
            {facturas.length === 0 ? (
              <div className="py-12 text-center text-[#6B7280] text-sm">No hay facturas procesadas aún.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1F1F1F]">
                      {['Periodo', 'Importe', 'kWh', 'Ahorro estimado', 'Fee', ''].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map((f) => (
                      <tr key={f.id} className="border-b border-[#1F1F1F] last:border-0 hover:bg-[#1A1A1A]">
                        <td className="px-5 py-3 text-[#9CA3AF] text-xs">
                          {f.fecha_inicio ? `${formatDate(f.fecha_inicio)} – ${formatDate(f.fecha_fin!)}` : '—'}
                        </td>
                        <td className="px-5 py-3 text-white font-medium">{f.total_factura ? formatCurrency(f.total_factura) : '—'}</td>
                        <td className="px-5 py-3 text-[#9CA3AF]">{f.kwh_total?.toLocaleString('es-ES') ?? '—'}</td>
                        <td className="px-5 py-3 text-[#00E676] font-medium">{f.ahorro_estimado_anual ? formatCurrency(f.ahorro_estimado_anual) : '—'}</td>
                        <td className="px-5 py-3 text-[#9CA3AF]">{f.fee_aplicado ?? '—'} €/MWh</td>
                        <td className="px-5 py-3">
                          {f.pdf_url && (
                            <a href={f.pdf_url} target="_blank" rel="noopener noreferrer" className="text-[#6B7280] hover:text-[#00E676]">
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>

        {/* Right panel */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="w-full xl:w-80 space-y-5">
          {/* Estado y notas */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4">Gestión</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-2">Estado</label>
                <Select value={estado} onValueChange={(v) => setEstado(v as ClienteEstado)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-2">Próximo contacto</label>
                <Input type="date" value={proximoContacto} onChange={(e) => setProximoContacto(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-2">Notas</label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] px-3 py-2 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#00E676] resize-none"
                  placeholder="Notas internas..."
                />
              </div>
            </div>
          </div>

          {/* Cartera / fee fields */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4">Datos de cartera</h2>
            <div className="space-y-3">
              {[
                { label: 'Fee energía (€/MWh)',     value: feeEnergia,          set: setFeeEnergia,          type: 'number', step: '0.5' },
                { label: 'Fee potencia (€/kW·año)', value: feePotencia,         set: setFeePotencia,         type: 'number', step: '0.1' },
                { label: 'kWh anuales',             value: kwhAnuales,          set: setKwhAnuales,          type: 'number', step: '1000' },
                { label: 'kW contratados',          value: kwContratados,       set: setKwContratados,       type: 'number', step: '0.5' },
                { label: 'Inicio contrato',         value: fechaInicioContrato, set: setFechaInicioContrato, type: 'date' },
              ].map(({ label, value, set, type, step }) => (
                <div key={label}>
                  <label className="block text-xs text-[#9CA3AF] mb-1">{label}</label>
                  <Input type={type} step={step} value={value} onChange={(e) => set(e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar cambios
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
