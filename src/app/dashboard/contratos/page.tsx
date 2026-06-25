'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, CheckCircle2, Loader2, X, Save, FileCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getSupabaseClient } from '@/lib/supabase'
import { formatDate, formatCurrency } from '@/lib/utils'
import { useToast } from '@/lib/use-toast'
import type { Contrato, Cliente, ContratoEstado } from '@/types'

function diasRestantes(fecha: string): number {
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
}

function DiaBadge({ dias, verificado }: { dias: number; verificado: boolean }) {
  if (verificado) return <Badge variant="secondary">Verificado</Badge>
  if (dias < 0)  return <Badge variant="red">{Math.abs(dias)}d vencido</Badge>
  if (dias <= 7)  return <Badge variant="red">{dias}d</Badge>
  if (dias <= 30) return <Badge variant="yellow">{dias}d</Badge>
  return <Badge variant="default">{dias}d</Badge>
}

const EMPTY: {
  cliente_id: string; cups: string; comercializadora: string; tarifa: string
  producto: string; fecha_firma: string; fecha_alta: string; fecha_vencimiento: string
  duracion_meses: string; estado: ContratoEstado; a_cobrar: string; notas: string
} = {
  cliente_id: '', cups: '', comercializadora: '', tarifa: '', producto: '',
  fecha_firma: '', fecha_alta: '', fecha_vencimiento: '', duracion_meses: '12',
  estado: 'activo', a_cobrar: '', notas: '',
}

export default function ContratosPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nombre' | 'empresa'>[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'proximos' | 'todos'>('proximos')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = getSupabaseClient()
    const [{ data: c }, { data: cl }] = await Promise.all([
      supabase.from('contratos')
        .select('*')
        .order('fecha_vencimiento', { ascending: true, nullsFirst: false }),
      supabase.from('clientes').select('id,nombre,empresa').order('nombre'),
    ])
    setContratos((c ?? []) as Contrato[])
    setClientes(cl ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Abrir formulario con cliente pre-seleccionado si viene de ?cliente_id=xxx
  useEffect(() => {
    const clienteId = searchParams.get('cliente_id')
    if (clienteId) {
      setForm({ ...EMPTY, cliente_id: clienteId })
      setEditId(null)
      setShowForm(true)
    }
  }, [searchParams])

  const proximos = contratos.filter(c =>
    c.fecha_vencimiento &&
    diasRestantes(c.fecha_vencimiento) <= 30 &&
    diasRestantes(c.fecha_vencimiento) >= 0 &&
    !c.renovacion_verificada &&
    c.estado === 'activo'
  )

  const filtered = tab === 'proximos' ? proximos : contratos

  async function handleToggle(id: string, current: boolean) {
    setToggling(id)
    const { error } = await getSupabaseClient()
      .from('contratos').update({ renovacion_verificada: !current }).eq('id', id)
    if (!error) setContratos(p => p.map(c => c.id === id ? { ...c, renovacion_verificada: !current } : c))
    else toast({ title: 'Error', variant: 'destructive' })
    setToggling(null)
  }

  async function handleSave() {
    if (!form.fecha_vencimiento) {
      toast({ title: 'La fecha de vencimiento es obligatoria', variant: 'destructive' })
      return
    }
    setSaving(true)
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      user_id: user!.id,
      cliente_id:        form.cliente_id        || null,
      cups:              form.cups              || null,
      comercializadora:  form.comercializadora  || null,
      tarifa:            form.tarifa            || null,
      producto:          form.producto          || null,
      fecha_firma:       form.fecha_firma       || null,
      fecha_alta:        form.fecha_alta        || null,
      fecha_vencimiento: form.fecha_vencimiento,
      duracion_meses:    form.duracion_meses ? Number(form.duracion_meses) : 12,
      estado:            form.estado,
      a_cobrar:          form.a_cobrar ? Number(form.a_cobrar) : null,
      notas:             form.notas             || null,
    }
    const { error } = editId
      ? await supabase.from('contratos').update(payload).eq('id', editId)
      : await supabase.from('contratos').insert(payload)

    if (error) {
      toast({ title: 'Error al guardar el contrato', variant: 'destructive' })
    } else {
      toast({ title: editId ? 'Contrato actualizado' : 'Contrato creado' })
      setShowForm(false); setEditId(null); setForm({ ...EMPTY })
      load()
    }
    setSaving(false)
  }

  function openEdit(c: Contrato) {
    setForm({
      cliente_id:        c.cliente_id        ?? '',
      cups:              c.cups              ?? '',
      comercializadora:  c.comercializadora  ?? '',
      tarifa:            c.tarifa            ?? '',
      producto:          c.producto          ?? '',
      fecha_firma:       c.fecha_firma        ?? '',
      fecha_alta:        c.fecha_alta         ?? '',
      fecha_vencimiento: c.fecha_vencimiento  ?? '',
      duracion_meses:    String(c.duracion_meses ?? 12),
      estado:            c.estado,
      a_cobrar:          c.a_cobrar != null ? String(c.a_cobrar) : '',
      notas:             c.notas ?? '',
    })
    setEditId(c.id)
    setShowForm(true)
  }

  const activos        = contratos.filter(c => c.estado === 'activo')
  const verificados    = contratos.filter(c => c.renovacion_verificada)
  const comisionTotal  = activos.reduce((s, c) => s + (c.a_cobrar ?? 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Contratos</h1>
          <p className="text-[#6B7280] text-sm mt-1">Gestión y renovaciones</p>
        </div>
        <Button onClick={() => { setForm({ ...EMPTY }); setEditId(null); setShowForm(true) }} className="gap-2">
          <Plus className="w-4 h-4" />Nuevo contrato
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Activos',              value: activos.length,          color: 'text-[#42A5F5]' },
          { label: '≤30 días sin verificar', value: proximos.length,       color: proximos.length > 0 ? 'text-yellow-400' : 'text-[#6B7280]', urgent: proximos.length > 0 },
          { label: 'Verificados',          value: verificados.length,      color: 'text-[#00E676]' },
          { label: 'Comisión activos',     value: formatCurrency(comisionTotal), color: 'text-[#00E676]' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className={`bg-[#141414] border rounded-xl p-5 ${s.urgent ? 'border-yellow-500/30' : 'border-[#1F1F1F]'}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[#6B7280] text-sm mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {([
          { key: 'proximos', label: `Próximos${proximos.length > 0 ? ` (${proximos.length})` : ''}` },
          { key: 'todos',    label: 'Todos' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
              tab === key
                ? 'bg-[#00E676]/10 border-[#00E676]/30 text-[#00E676]'
                : 'bg-[#141414] border-[#1F1F1F] text-[#6B7280] hover:text-white hover:border-[#2A2A2A]'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 rounded-full border-2 border-[#00E676]/30 border-t-[#00E676] animate-spin" />
        </div>
      ) : (
        <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#1F1F1F] flex items-center justify-center">
                <FileCheck className="w-6 h-6 text-[#6B7280]" />
              </div>
              <p className="text-[#6B7280] text-sm">
                {tab === 'proximos' ? 'No hay contratos próximos a vencer.' : 'No hay contratos aún.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1F1F1F]">
                    {['Vence en', 'Cliente', 'CUPS', 'Comercializadora', 'Producto', 'Vencimiento', 'Comisión', 'Renovación'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => {
                    const dias = c.fecha_vencimiento ? diasRestantes(c.fecha_vencimiento) : null
                    const clienteInfo = clientes.find(cl => cl.id === c.cliente_id)
                    const nombre = clienteInfo?.nombre ?? c.cups ?? '—'
                    return (
                      <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                        className="border-b border-[#1F1F1F] last:border-0 hover:bg-[#1A1A1A] transition-colors cursor-pointer"
                        onClick={() => openEdit(c)}>
                        <td className="px-4 py-3">
                          {dias !== null ? <DiaBadge dias={dias} verificado={c.renovacion_verificada} /> : '—'}
                        </td>
                        <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{nombre}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#9CA3AF]">{c.cups?.slice(0, 14) ?? '—'}</td>
                        <td className="px-4 py-3 text-[#9CA3AF]">{c.comercializadora ?? '—'}</td>
                        <td className="px-4 py-3 text-[#9CA3AF]">{c.producto ?? '—'}</td>
                        <td className="px-4 py-3 text-[#9CA3AF] text-xs whitespace-nowrap">
                          {c.fecha_vencimiento ? formatDate(c.fecha_vencimiento) : '—'}
                        </td>
                        <td className="px-4 py-3 text-white font-medium">
                          {c.a_cobrar ? formatCurrency(c.a_cobrar) : '—'}
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggle(c.id, c.renovacion_verificada)}
                            disabled={toggling === c.id}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              c.renovacion_verificada
                                ? 'bg-[#00E676]/10 border-[#00E676]/30 text-[#00E676]'
                                : 'bg-[#1A1A1A] border-[#2A2A2A] text-[#6B7280] hover:border-[#3A3A3A] hover:text-white'
                            }`}>
                            {toggling === c.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <CheckCircle2 className="w-3 h-3" />}
                            {c.renovacion_verificada ? 'Verificado' : 'Verificar'}
                          </button>
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

      {/* Slide-in form */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60"
              onClick={() => setShowForm(false)}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[#0D0D0D] border-l border-[#1F1F1F] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between p-6 border-b border-[#1F1F1F] sticky top-0 bg-[#0D0D0D] z-10">
                <h2 className="text-white font-semibold">{editId ? 'Editar contrato' : 'Nuevo contrato'}</h2>
                <button onClick={() => setShowForm(false)} className="text-[#6B7280] hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1.5">Cliente</label>
                  <Select value={form.cliente_id || undefined} onValueChange={v => setForm(p => ({ ...p, cliente_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                    <SelectContent>
                      {clientes.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre}{c.empresa ? ` — ${c.empresa}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {([
                  { label: 'CUPS',             key: 'cups',             placeholder: 'ES0021...' },
                  { label: 'Comercializadora', key: 'comercializadora', placeholder: '' },
                  { label: 'Tarifa',           key: 'tarifa',           placeholder: '2.0TD / 3.0TD' },
                  { label: 'Producto',         key: 'producto',         placeholder: '' },
                ] as const).map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs text-[#9CA3AF] mb-1.5">{label}</label>
                    <Input placeholder={placeholder} value={form[key]}
                      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#9CA3AF] mb-1.5">Fecha firma</label>
                    <Input type="date" value={form.fecha_firma}
                      onChange={e => setForm(p => ({ ...p, fecha_firma: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9CA3AF] mb-1.5">Fecha alta</label>
                    <Input type="date" value={form.fecha_alta}
                      onChange={e => setForm(p => ({ ...p, fecha_alta: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#9CA3AF] mb-1.5">Vencimiento *</label>
                    <Input type="date" value={form.fecha_vencimiento}
                      onChange={e => setForm(p => ({ ...p, fecha_vencimiento: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9CA3AF] mb-1.5">Duración (meses)</label>
                    <Input type="number" value={form.duracion_meses}
                      onChange={e => setForm(p => ({ ...p, duracion_meses: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#9CA3AF] mb-1.5">Estado</label>
                    <Select value={form.estado} onValueChange={v => setForm(p => ({ ...p, estado: v as ContratoEstado }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="baja">Baja</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#9CA3AF] mb-1.5">Comisión (€)</label>
                    <Input type="number" step="0.01" value={form.a_cobrar}
                      onChange={e => setForm(p => ({ ...p, a_cobrar: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1.5">Notas</label>
                  <textarea rows={3} value={form.notas}
                    onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                    className="w-full rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] px-3 py-2 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#00E676] resize-none"
                    placeholder="Observaciones..." />
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editId ? 'Guardar cambios' : 'Crear contrato'}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
