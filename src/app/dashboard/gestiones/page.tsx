'use client'
import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, CheckCircle2, Loader2, X, Save, ClipboardList, Send, History, Mic, MessageSquare, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getSupabaseClient } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/lib/use-toast'
import type { Gestion, GestionEvento, Cliente, GestionTipoVal, GestionEstadoVal, GestionViaVal } from '@/types'

function diasRestantes(fecha: string): number {
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
}

function SeguimientoBadge({ g }: { g: Gestion }) {
  if (g.estado === 'resuelto') return <Badge variant="secondary">Resuelta</Badge>
  if (!g.proximo_seguimiento)  return <Badge variant="default">Sin fecha</Badge>
  const dias = diasRestantes(g.proximo_seguimiento)
  if (dias < 0)  return <Badge variant="red">{Math.abs(dias)}d vencida</Badge>
  if (dias === 0) return <Badge variant="red">Hoy</Badge>
  if (dias <= 2)  return <Badge variant="yellow">{dias}d</Badge>
  return <Badge variant="default">{dias}d</Badge>
}

const TIPO_LABELS: Record<GestionTipoVal, string> = {
  solicitamos:   'Solicitamos',
  nos_solicitan: 'Nos solicitan',
}

const ESTADO_LABELS: Record<GestionEstadoVal, string> = {
  pendiente: 'Pendiente',
  en_curso:  'En curso',
  resuelto:  'Resuelta',
}

const EMPTY: {
  cliente_id: string; titular: string; cups: string; compania: string
  tipo: GestionTipoVal; asunto: string; via: GestionViaVal
  proximo_seguimiento: string; estado: GestionEstadoVal; resolucion: string; notas: string
} = {
  cliente_id: '', titular: '', cups: '', compania: '', tipo: 'solicitamos',
  asunto: '', via: 'email', proximo_seguimiento: '', estado: 'en_curso', resolucion: '', notas: '',
}

export default function GestionesPage() {
  const { toast } = useToast()
  const [gestiones, setGestiones] = useState<Gestion[]>([])
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nombre' | 'empresa' | 'cups'>[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'abiertas' | 'todas'>('abiertas')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Gestion | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  // Historial de la gestión en edición
  const [eventos, setEventos] = useState<GestionEvento[]>([])
  const [nuevoEvento, setNuevoEvento] = useState('')
  const [addingEvento, setAddingEvento] = useState(false)

  const load = useCallback(async () => {
    const supabase = getSupabaseClient()
    const [{ data: g }, { data: cl }] = await Promise.all([
      supabase.from('gestiones')
        .select('*')
        .order('proximo_seguimiento', { ascending: true, nullsFirst: false }),
      supabase.from('clientes').select('id,nombre,empresa,cups').order('nombre'),
    ])
    setGestiones((g ?? []) as Gestion[])
    setClientes(cl ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Abrir formulario con cliente pre-seleccionado si viene de ?cliente_id=xxx
  useEffect(() => {
    const clienteId = new URLSearchParams(window.location.search).get('cliente_id')
    if (clienteId) {
      setForm({ ...EMPTY, cliente_id: clienteId })
      setEditId(null)
      setShowForm(true)
    }
  }, [])

  const abiertas = gestiones.filter(g => g.estado !== 'resuelto')
  const hoy = new Date().toISOString().split('T')[0]
  const vencidas = abiertas.filter(g => g.proximo_seguimiento && g.proximo_seguimiento <= hoy)
  const proximas7 = abiertas.filter(g => {
    if (!g.proximo_seguimiento || g.proximo_seguimiento <= hoy) return false
    return diasRestantes(g.proximo_seguimiento) <= 7
  })
  const resueltas = gestiones.filter(g => g.estado === 'resuelto')

  const filtered = tab === 'abiertas' ? abiertas : gestiones

  function nombreDe(g: Gestion): string {
    return clientes.find(c => c.id === g.cliente_id)?.nombre ?? g.titular ?? '—'
  }

  async function loadEventos(gestionId: string) {
    const { data } = await getSupabaseClient()
      .from('gestion_eventos')
      .select('*')
      .eq('gestion_id', gestionId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    setEventos((data ?? []) as GestionEvento[])
  }

  async function handleAddEvento() {
    if (!editId || !nuevoEvento.trim()) return
    setAddingEvento(true)
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('gestion_eventos').insert({
      gestion_id: editId,
      user_id:    user!.id,
      nota:       nuevoEvento.trim(),
    })
    if (error) {
      toast({ title: 'Error al guardar la actuación', variant: 'destructive' })
    } else {
      setNuevoEvento('')
      loadEventos(editId)
    }
    setAddingEvento(false)
  }

  async function handleSave() {
    if (!form.compania.trim() || !form.asunto.trim()) {
      toast({ title: 'Compañía y asunto son obligatorios', variant: 'destructive' })
      return
    }
    setSaving(true)
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    const resuelto = form.estado === 'resuelto'
    const payload = {
      user_id:             user!.id,
      cliente_id:          form.cliente_id || null,
      titular:             form.titular    || null,
      cups:                form.cups       || null,
      compania:            form.compania.trim(),
      tipo:                form.tipo,
      asunto:              form.asunto.trim(),
      via:                 form.via,
      proximo_seguimiento: resuelto ? null : (form.proximo_seguimiento || null),
      estado:              form.estado,
      resolucion:          form.resolucion || null,
      fecha_resolucion:    resuelto ? new Date().toISOString().split('T')[0] : null,
      notas:               form.notas || null,
      revisar_cliente:     form.cliente_id ? false : (editing?.revisar_cliente ?? false),
    }
    const { data, error } = editId
      ? await supabase.from('gestiones').update(payload).eq('id', editId).select('id').single()
      : await supabase.from('gestiones').insert(payload).select('id').single()

    if (error) {
      toast({ title: 'Error al guardar la gestión', variant: 'destructive' })
    } else {
      // Log automático de resolución en el historial
      if (resuelto && editId) {
        const anterior = gestiones.find(g => g.id === editId)
        if (anterior && anterior.estado !== 'resuelto') {
          await supabase.from('gestion_eventos').insert({
            gestion_id: editId,
            user_id:    user!.id,
            nota:       `[Sistema] Gestión resuelta${form.resolucion ? `: ${form.resolucion}` : ''}`,
          })
        }
      }
      // Alta inicial: dejar constancia en el historial
      if (!editId && data) {
        await supabase.from('gestion_eventos').insert({
          gestion_id: data.id,
          user_id:    user!.id,
          nota:       `[Sistema] Gestión abierta (${TIPO_LABELS[form.tipo]}, vía ${form.via})`,
        })
      }
      toast({ title: editId ? 'Gestión actualizada' : 'Gestión creada' })
      setShowForm(false); setEditId(null); setForm({ ...EMPTY }); setEventos([])
      load()
    }
    setSaving(false)
  }

  function openEdit(g: Gestion) {
    setForm({
      cliente_id:          g.cliente_id          ?? '',
      titular:             g.titular             ?? '',
      cups:                g.cups                ?? '',
      compania:            g.compania,
      tipo:                g.tipo,
      asunto:              g.asunto,
      via:                 g.via,
      proximo_seguimiento: g.proximo_seguimiento ?? '',
      estado:              g.estado,
      resolucion:          g.resolucion          ?? '',
      notas:               g.notas               ?? '',
    })
    setEditId(g.id)
    setEditing(g)
    setEventos([])
    setNuevoEvento('')
    loadEventos(g.id)
    setShowForm(true)
  }

  function openNew() {
    setForm({ ...EMPTY })
    setEditId(null)
    setEditing(null)
    setEventos([])
    setNuevoEvento('')
    setShowForm(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestiones</h1>
          <p className="text-[#6B7280] text-sm mt-1">Solicitudes e incidencias con comercializadoras y distribuidoras</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" />Nueva gestión
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Abiertas',      value: abiertas.length,  color: 'text-[#42A5F5]' },
          { label: 'Vencidas',      value: vencidas.length,  color: vencidas.length > 0 ? 'text-red-400' : 'text-[#6B7280]', urgent: vencidas.length > 0 },
          { label: 'Próx. 7 días',  value: proximas7.length, color: proximas7.length > 0 ? 'text-yellow-400' : 'text-[#6B7280]' },
          { label: 'Resueltas',     value: resueltas.length, color: 'text-[#00E676]' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className={`bg-[#141414] border rounded-xl p-5 ${s.urgent ? 'border-red-500/30' : 'border-[#1F1F1F]'}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[#6B7280] text-sm mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {([
          { key: 'abiertas', label: `Abiertas${abiertas.length > 0 ? ` (${abiertas.length})` : ''}` },
          { key: 'todas',    label: 'Todas' },
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
                <ClipboardList className="w-6 h-6 text-[#6B7280]" />
              </div>
              <p className="text-[#6B7280] text-sm">
                {tab === 'abiertas' ? 'No hay gestiones abiertas.' : 'No hay gestiones aún.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1F1F1F]">
                    {['Seguimiento', 'Cliente', 'Compañía', 'Tipo', 'Asunto', 'Próx. fecha', 'Estado'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g, i) => (
                    <motion.tr key={g.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className={`border-b last:border-0 hover:bg-[#1A1A1A] transition-colors cursor-pointer ${
                        g.revisar_cliente ? 'border-yellow-500/30 bg-yellow-500/[0.03]' : 'border-[#1F1F1F]'
                      }`}
                      onClick={() => openEdit(g)}>
                      <td className="px-4 py-3"><SeguimientoBadge g={g} /></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {g.origen === 'audio' && <Mic className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />}
                          {g.origen === 'texto' && <MessageSquare className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />}
                          {g.cliente_id ? (
                            <Link href={`/dashboard/clientes/${g.cliente_id}`} onClick={e => e.stopPropagation()}
                              className="text-white font-medium hover:text-[#00E676] transition-colors">
                              {nombreDe(g)}
                            </Link>
                          ) : (
                            <span className="text-white font-medium">{nombreDe(g)}</span>
                          )}
                          {g.revisar_cliente && <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#9CA3AF] whitespace-nowrap">{g.compania}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${
                          g.tipo === 'solicitamos'
                            ? 'text-[#42A5F5] border-[#42A5F5]/30 bg-[#42A5F5]/5'
                            : 'text-orange-400 border-orange-400/30 bg-orange-400/5'
                        }`}>
                          {TIPO_LABELS[g.tipo]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#9CA3AF] max-w-md">
                        <span className="line-clamp-2">{g.asunto}</span>
                      </td>
                      <td className="px-4 py-3 text-[#9CA3AF] text-xs whitespace-nowrap">
                        {g.proximo_seguimiento ? formatDate(g.proximo_seguimiento) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${
                          g.estado === 'resuelto'
                            ? 'text-[#00E676] border-[#00E676]/30 bg-[#00E676]/5'
                            : g.estado === 'en_curso'
                            ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5'
                            : 'text-[#9CA3AF] border-[#2A2A2A] bg-[#1A1A1A]'
                        }`}>
                          {ESTADO_LABELS[g.estado]}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
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
                <h2 className="text-white font-semibold">{editId ? 'Editar gestión' : 'Nueva gestión'}</h2>
                <button onClick={() => setShowForm(false)} className="text-[#6B7280] hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {editing?.revisar_cliente && (
                  <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                    <p className="text-yellow-200 text-xs">
                      Creada desde un audio sin match seguro de cliente — revisa el nombre y selecciónalo abajo.
                    </p>
                  </div>
                )}

                {editing?.transcripcion && (
                  <div className="bg-[#0F0F0F] border border-[#2A2A2A] rounded-lg p-3">
                    <p className="text-[#6B7280] text-[11px] uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                      {editing.origen === 'texto'
                        ? <><MessageSquare className="w-3 h-3" />Mensaje de texto recibido</>
                        : <><Mic className="w-3 h-3" />Transcripción del audio</>}
                    </p>
                    <p className="text-[#D1D5DB] text-xs whitespace-pre-wrap">{editing.transcripcion}</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1.5">Cliente</label>
                  <Select value={form.cliente_id || undefined} onValueChange={v => {
                    const cl = clientes.find(c => c.id === v)
                    setForm(p => ({ ...p, cliente_id: v, cups: p.cups || cl?.cups || '' }))
                  }}>
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

                {!form.cliente_id && (
                  <div>
                    <label className="block text-xs text-[#9CA3AF] mb-1.5">Titular (si no está en clientes)</label>
                    <Input placeholder="Nombre del titular" value={form.titular}
                      onChange={e => setForm(p => ({ ...p, titular: e.target.value }))} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#9CA3AF] mb-1.5">Compañía *</label>
                    <Input placeholder="TotalEnergies, i-DE..." value={form.compania}
                      onChange={e => setForm(p => ({ ...p, compania: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9CA3AF] mb-1.5">CUPS</label>
                    <Input placeholder="ES0021..." value={form.cups}
                      onChange={e => setForm(p => ({ ...p, cups: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#9CA3AF] mb-1.5">Tipo</label>
                    <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v as GestionTipoVal }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solicitamos">Solicitamos</SelectItem>
                        <SelectItem value="nos_solicitan">Nos solicitan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#9CA3AF] mb-1.5">Vía</label>
                    <Select value={form.via} onValueChange={v => setForm(p => ({ ...p, via: v as GestionViaVal }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="telefono">Teléfono</SelectItem>
                        <SelectItem value="portal">Portal</SelectItem>
                        <SelectItem value="carta">Carta</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1.5">Asunto *</label>
                  <textarea rows={3} value={form.asunto}
                    onChange={e => setForm(p => ({ ...p, asunto: e.target.value }))}
                    className="w-full rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] px-3 py-2 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#00E676] resize-none"
                    placeholder="Qué se ha solicitado / qué nos piden..." />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#9CA3AF] mb-1.5">Próx. seguimiento</label>
                    <Input type="date" value={form.proximo_seguimiento}
                      onChange={e => setForm(p => ({ ...p, proximo_seguimiento: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9CA3AF] mb-1.5">Estado</label>
                    <Select value={form.estado} onValueChange={v => setForm(p => ({ ...p, estado: v as GestionEstadoVal }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="en_curso">En curso</SelectItem>
                        <SelectItem value="resuelto">✓ Resuelta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {form.estado === 'resuelto' && (
                  <div>
                    <label className="block text-xs text-[#9CA3AF] mb-1.5">Resolución (cómo se solucionó)</label>
                    <textarea rows={3} value={form.resolucion}
                      onChange={e => setForm(p => ({ ...p, resolucion: e.target.value }))}
                      className="w-full rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] px-3 py-2 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#00E676] resize-none"
                      placeholder="Refacturación emitida, abono de X €..." />
                  </div>
                )}

                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1.5">Notas</label>
                  <textarea rows={2} value={form.notas}
                    onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                    className="w-full rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] px-3 py-2 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#00E676] resize-none"
                    placeholder="Nº de reclamación, referencias..." />
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editId ? 'Guardar cambios' : 'Crear gestión'}
                </Button>

                {/* Historial de actuaciones */}
                {editId && (
                  <div className="pt-4 border-t border-[#1F1F1F]">
                    <h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                      <History className="w-4 h-4 text-[#00E676]" />
                      Historial
                    </h3>
                    <div className="flex gap-2 mb-4">
                      <Input placeholder="Nueva actuación (llamada, respuesta recibida...)" value={nuevoEvento}
                        onChange={e => setNuevoEvento(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddEvento() }} />
                      <Button size="sm" variant="secondary" onClick={handleAddEvento}
                        disabled={addingEvento || !nuevoEvento.trim()} className="shrink-0 gap-1.5">
                        {addingEvento ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                    {eventos.length === 0 ? (
                      <p className="text-[#6B7280] text-xs">Sin actuaciones registradas.</p>
                    ) : (
                      <div className="space-y-3">
                        {eventos.map(ev => (
                          <div key={ev.id} className="flex gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#00E676] mt-1.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[#6B7280] text-[11px]">{formatDate(ev.fecha)}</p>
                              <p className="text-[#D1D5DB] text-xs whitespace-pre-wrap">{ev.nota}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
