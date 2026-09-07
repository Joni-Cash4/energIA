'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Banknote, Loader2, Pencil, Check, X, FileCheck, ShieldCheck, Upload, AlertTriangle } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/lib/use-toast'
import { conciliarPrefactura, type ResultadoConciliacion, type CuotaPendiente } from '@/lib/prefacturas'
import type { ComisionGenerada } from '@/types'

// Tipo de IVA general — no varía entre las empresas pagadoras.
const IVA_PCT = 21

const TIPO_LABELS: Record<string, string> = {
  alta: 'Alta',
  renovacion: 'Renovación',
  correccion: 'Corrección',
}

function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function ultimoDiaMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  // getDate() sobre "día 0 del mes siguiente" da el último día del mes en hora
  // local; construimos la cadena a mano para no pasar por toISOString() (UTC),
  // que restaba un día en zonas con offset positivo y dejaba fuera del filtro
  // las comisiones fechadas el último día del mes.
  const ultimoDia = new Date(y, m, 0).getDate()
  return `${mes}-${String(ultimoDia).padStart(2, '0')}`
}

// "2026-08" → "agosto 2026" (con inicial mayúscula) para el desplegable.
function nombreMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── inline-edit de importe (mismo patrón que dashboard/comisiones) ───────────
function InlineEditImporte({
  value, onSave,
}: { value: number; onSave: (v: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(String(value)); setEditing(true) }}
        className="flex items-center gap-1 text-sm tabular-nums hover:text-white text-[#E5E7EB] transition-colors group"
      >
        {formatCurrency(value)}
        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number" step="0.01" value={draft}
        onChange={e => setDraft(e.target.value)}
        className="h-7 w-24 text-xs px-2"
        autoFocus
        onKeyDown={async e => {
          if (e.key === 'Enter') { setSaving(true); await onSave(Number(draft)); setSaving(false); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
      />
      <button
        onClick={async () => { setSaving(true); await onSave(Number(draft)); setSaving(false); setEditing(false) }}
        disabled={saving}
        className="text-[#00E676] hover:text-[#00E676]/80"
      >
        <Check className="w-4 h-4" />
      </button>
      <button onClick={() => setEditing(false)} className="text-[#4B5563] hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export default function FacturacionPage() {
  const { toast } = useToast()
  const [mes, setMes] = useState(mesActual())
  const [vista, setVista] = useState<'pendientes' | 'facturadas'>('pendientes')
  const [comisiones, setComisiones] = useState<ComisionGenerada[]>([])
  const [loading, setLoading] = useState(true)
  const [marcando, setMarcando] = useState<string | null>(null)

  // Verificar prefactura: una empresa a la vez (subir archivo → conciliar
  // contra las líneas pendientes de esa empresa → confirmar selección).
  const [verificandoEmpresaId, setVerificandoEmpresaId] = useState<string | null>(null)
  const [subiendoPrefactura, setSubiendoPrefactura] = useState(false)
  const [prefacturaExtraida, setPrefacturaExtraida] = useState<{ numero_prefactura: string | null; path: string } | null>(null)
  const [resultado, setResultado] = useState<ResultadoConciliacion | null>(null)
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [confirmandoPrefactura, setConfirmandoPrefactura] = useState(false)
  // Meses que tienen comisiones en la vista actual (pendientes o facturadas),
  // para el desplegable de salto rápido.
  const [mesesDisponibles, setMesesDisponibles] = useState<{ mes: string; count: number; total: number }[]>([])

  const facturado = vista === 'facturadas'

  const loadMeses = useCallback(async () => {
    const supabase = getSupabaseClient()
    const { data } = await supabase
      .from('comisiones_generadas')
      .select('fecha, importe')
      .eq('facturado', facturado)
    const map = new Map<string, { count: number; total: number }>()
    for (const c of (data ?? []) as { fecha: string; importe: number }[]) {
      const m = c.fecha.slice(0, 7)
      const acc = map.get(m) ?? { count: 0, total: 0 }
      acc.count += 1
      acc.total += c.importe
      map.set(m, acc)
    }
    const lista = Array.from(map.entries())
      .map(([mes, v]) => ({ mes, ...v }))
      .sort((a, b) => b.mes.localeCompare(a.mes)) // más reciente primero
    setMesesDisponibles(lista)
  }, [facturado])

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = getSupabaseClient()
    const { data } = await supabase
      .from('comisiones_generadas')
      .select('*, empresa_pago:empresas_pago(id,nombre,nif,retencion_pct), cliente:clientes(id,nombre,empresa)')
      .eq('facturado', facturado)
      .gte('fecha', `${mes}-01`)
      .lte('fecha', ultimoDiaMes(mes))
      .order('fecha', { ascending: true })

    setComisiones((data ?? []) as unknown as ComisionGenerada[])
    setLoading(false)
  }, [mes, facturado])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadMeses() }, [loadMeses])

  const grupos = useMemo(() => {
    const map = new Map<string, { empresa: NonNullable<ComisionGenerada['empresa_pago']>; filas: ComisionGenerada[] }>()
    for (const c of comisiones) {
      if (!c.empresa_pago) continue
      const key = c.empresa_pago.id
      if (!map.has(key)) map.set(key, { empresa: c.empresa_pago, filas: [] })
      map.get(key)!.filas.push(c)
    }
    return Array.from(map.values()).sort((a, b) => a.empresa.nombre.localeCompare(b.empresa.nombre))
  }, [comisiones])

  async function updateImporte(id: string, importe: number) {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('comisiones_generadas').update({ importe }).eq('id', id)
    if (error) { toast({ title: 'Error al guardar', variant: 'destructive' }); return }
    setComisiones(p => p.map(c => c.id === id ? { ...c, importe } : c))
  }

  async function marcarFacturado(empresaId: string, filas: ComisionGenerada[]) {
    const numeroFactura = window.prompt('Nº de factura de haztufactura (opcional):')
    setMarcando(empresaId)
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('comisiones_generadas')
      .update({ facturado: true, numero_factura: numeroFactura || null })
      .in('id', filas.map(f => f.id))
    if (error) toast({ title: 'Error al marcar como facturado', variant: 'destructive' })
    else { toast({ title: 'Marcado como facturado' }); await load(); await loadMeses() }
    setMarcando(null)
  }

  // Revierte una empresa ya facturada a pendiente (p.ej. si te equivocaste de
  // mes o anulaste la factura). Borra también el nº de factura asociado.
  async function desmarcarFacturado(empresaId: string, filas: ComisionGenerada[]) {
    if (!window.confirm('¿Devolver estas líneas a "pendientes de facturar"? Se borrará su nº de factura.')) return
    setMarcando(empresaId)
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('comisiones_generadas')
      .update({ facturado: false, numero_factura: null })
      .in('id', filas.map(f => f.id))
    if (error) toast({ title: 'Error al desmarcar', variant: 'destructive' })
    else { toast({ title: 'Devuelto a pendientes' }); await load(); await loadMeses() }
    setMarcando(null)
  }

  async function handleSubirPrefactura(empresaId: string, filasEmpresa: ComisionGenerada[], file: File) {
    setVerificandoEmpresaId(empresaId)
    setSubiendoPrefactura(true)
    setResultado(null)
    setPrefacturaExtraida(null)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('empresaPagoId', empresaId)
      const res = await fetch('/api/prefactura/upload', { method: 'POST', body })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: json.error ?? 'Error al analizar la prefactura', variant: 'destructive' })
        return
      }
      setPrefacturaExtraida({ numero_prefactura: json.extraido.numero_prefactura, path: json.path })
      const cuotasCandidatas: CuotaPendiente[] = filasEmpresa
        .filter(f => !f.verificado_prefactura)
        .map(f => ({
          id: f.id,
          importe: f.importe,
          fecha_prevista: f.fecha,
          clienteNombre: f.cliente?.nombre,
          clienteEmpresa: f.cliente?.empresa,
          cups: f.cups,
          comercializadora: f.comercializadora,
        }))
      const r = conciliarPrefactura(json.extraido.lineas, cuotasCandidatas)
      setResultado(r)
      setSeleccionadas(new Set(
        r.matches.filter(m => m.estado === 'confirmado' && m.cuota).map(m => m.cuota!.id),
      ))
    } catch {
      toast({ title: 'Error al subir la prefactura', variant: 'destructive' })
    } finally {
      setSubiendoPrefactura(false)
    }
  }

  function toggleSeleccionPrefactura(id: string) {
    setSeleccionadas(p => {
      const next = new Set(p)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function confirmarPrefactura() {
    if (!resultado || !prefacturaExtraida) return
    setConfirmandoPrefactura(true)
    const supabase = getSupabaseClient()
    const aConfirmar = resultado.matches.filter(m => m.cuota && seleccionadas.has(m.cuota.id))
    const nowISO = new Date().toISOString()
    const resultados = await Promise.all(aConfirmar.map(m => supabase.from('comisiones_generadas').update({
      verificado_prefactura: true,
      prefactura_importe: m.linea.importe,
      prefactura_evidencia_url: prefacturaExtraida.path,
      prefactura_num: prefacturaExtraida.numero_prefactura,
      verificado_en: nowISO,
    }).eq('id', m.cuota!.id)))
    const fallos = resultados.filter(r => r.error).length
    toast({
      title: fallos
        ? `${aConfirmar.length - fallos} verificada(s), ${fallos} con error`
        : `${aConfirmar.length} línea(s) verificada(s) contra la prefactura`,
      variant: fallos ? 'destructive' : undefined,
    })
    setResultado(null)
    setPrefacturaExtraida(null)
    setSeleccionadas(new Set())
    setVerificandoEmpresaId(null)
    await load()
    setConfirmandoPrefactura(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-[#00E676]/30 border-t-[#00E676] animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center">
            <Banknote className="w-5 h-5 text-[#00E676]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Facturación de comisiones</h1>
            <p className="text-[#6B7280] text-sm">Borrador mensual por empresa, listo para copiar en haztufactura</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle: pendientes de facturar vs. histórico ya facturado */}
          <div className="flex rounded-lg border border-[#1F1F1F] bg-[#141414] p-0.5">
            {(['pendientes', 'facturadas'] as const).map(v => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  vista === v ? 'bg-[#00E676] text-black' : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                {v === 'pendientes' ? 'Pendientes' : 'Facturadas'}
              </button>
            ))}
          </div>
          {/* Desplegable: salta directo a un mes con comisiones en esta vista */}
          <Select
            value={mesesDisponibles.some(m => m.mes === mes) ? mes : ''}
            onValueChange={v => setMes(v)}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder={facturado ? 'Meses facturados…' : 'Meses con pendientes…'} />
            </SelectTrigger>
            <SelectContent>
              {mesesDisponibles.length === 0 && (
                <div className="px-2 py-3 text-xs text-[#6B7280] text-center">
                  {facturado ? 'Nada facturado todavía' : 'Nada pendiente de facturar'}
                </div>
              )}
              {mesesDisponibles.map(m => (
                <SelectItem key={m.mes} value={m.mes}>
                  {nombreMes(m.mes)} · {m.count} línea{m.count === 1 ? '' : 's'} · {formatCurrency(m.total)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Selector libre para cualquier mes */}
          <Input
            type="month" value={mes}
            onChange={e => setMes(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {grupos.length === 0 && (
        <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl py-20 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#1F1F1F] flex items-center justify-center">
            <FileCheck className="w-6 h-6 text-[#6B7280]" />
          </div>
          <p className="text-[#6B7280] text-sm">
            {facturado ? 'No hay comisiones facturadas en este mes.' : 'No hay comisiones pendientes de facturar en este mes.'}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {grupos.map(({ empresa, filas }) => {
          const base = filas.reduce((s, f) => s + f.importe, 0)
          const iva = base * IVA_PCT / 100
          const total = base + iva
          const retencionPct = empresa.retencion_pct ?? 7
          const retencion = base * retencionPct / 100
          const neto = total - retencion

          return (
            <div key={empresa.id} className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1F1F1F] flex items-center justify-between">
                <div>
                  <h2 className="text-white font-semibold">{empresa.nombre}</h2>
                  <p className="text-[#6B7280] text-xs mt-0.5">
                    NIF {empresa.nif} · {filas.length} línea{filas.length === 1 ? '' : 's'}
                    {facturado && filas[0]?.numero_factura ? ` · Factura ${filas[0].numero_factura}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {!facturado && (
                    <label className="flex items-center gap-1.5 text-xs text-[#9CA3AF] cursor-pointer">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verificar prefactura
                      <input
                        type="file" accept="application/pdf,image/*,.xlsx,.xls" className="hidden"
                        disabled={subiendoPrefactura && verificandoEmpresaId === empresa.id}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleSubirPrefactura(empresa.id, filas, f); e.target.value = '' }}
                      />
                      {subiendoPrefactura && verificandoEmpresaId === empresa.id && <Loader2 className="w-3 h-3 animate-spin" />}
                    </label>
                  )}
                  {facturado ? (
                    <Button
                      variant="outline"
                      onClick={() => desmarcarFacturado(empresa.id, filas)}
                      disabled={marcando === empresa.id}
                      className="gap-2"
                    >
                      {marcando === empresa.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      Devolver a pendientes
                    </Button>
                  ) : (
                    <Button
                      onClick={() => marcarFacturado(empresa.id, filas)}
                      disabled={marcando === empresa.id}
                      className="gap-2"
                    >
                      {marcando === empresa.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                      Marcar como facturado
                    </Button>
                  )}
                </div>
              </div>

              {verificandoEmpresaId === empresa.id && resultado && (
                <div className="px-5 py-4 border-b border-[#1F1F1F] space-y-4">
                  {prefacturaExtraida?.numero_prefactura && (
                    <p className="text-xs text-[#9CA3AF]">Prefactura <span className="text-white font-medium">{prefacturaExtraida.numero_prefactura}</span></p>
                  )}

                  {resultado.matches.filter(m => m.estado === 'confirmado').length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[#00E676] font-semibold mb-1.5">Coinciden</p>
                      <div className="space-y-1">
                        {resultado.matches.filter(m => m.estado === 'confirmado').map(m => (
                          <label key={m.lineaIndex} className="flex items-center gap-2 text-xs text-[#E5E7EB] bg-[#00E676]/5 border border-[#00E676]/20 rounded-lg px-3 py-1.5">
                            <input type="checkbox" checked={seleccionadas.has(m.cuota!.id)} onChange={() => toggleSeleccionPrefactura(m.cuota!.id)} />
                            <span className="flex-1">{m.cuota!.clienteNombre ?? m.cuota!.clienteEmpresa ?? m.linea.referencia}</span>
                            <span className="tabular-nums text-white">{formatCurrency(m.linea.importe)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {resultado.matches.filter(m => m.estado === 'importe_distinto').length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-amber-400 font-semibold mb-1.5">Importe distinto</p>
                      <div className="space-y-1">
                        {resultado.matches.filter(m => m.estado === 'importe_distinto').map(m => (
                          <label key={m.lineaIndex} className="flex items-center gap-2 text-xs text-[#E5E7EB] bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-1.5">
                            <input type="checkbox" checked={seleccionadas.has(m.cuota!.id)} onChange={() => toggleSeleccionPrefactura(m.cuota!.id)} />
                            <span className="flex-1">{m.cuota!.clienteNombre ?? m.cuota!.clienteEmpresa ?? m.linea.referencia}</span>
                            <span className="tabular-nums text-[#9CA3AF]">previsto {formatCurrency(m.cuota!.importe)}</span>
                            <span className="tabular-nums text-amber-400">prefactura {formatCurrency(m.linea.importe)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {resultado.matches.filter(m => m.estado === 'sin_correspondencia').length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[#6B7280] font-semibold mb-1.5">En la prefactura, sin línea conocida</p>
                      <div className="space-y-1">
                        {resultado.matches.filter(m => m.estado === 'sin_correspondencia').map(m => (
                          <div key={m.lineaIndex} className="flex items-center gap-2 text-xs text-[#9CA3AF] bg-[#1A1A1A] rounded-lg px-3 py-1.5">
                            <span className="flex-1">{m.linea.referencia}</span>
                            <span className="tabular-nums">{formatCurrency(m.linea.importe)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {resultado.cuotasSinLinea.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-red-400 font-semibold mb-1.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />Pendientes de facturar, no aparecen en la prefactura
                      </p>
                      <div className="space-y-1">
                        {resultado.cuotasSinLinea.map(c => (
                          <div key={c.id} className="flex items-center gap-2 text-xs text-red-300 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-1.5">
                            <span className="flex-1">{c.clienteNombre ?? c.clienteEmpresa ?? c.cups ?? '—'}</span>
                            <span className="tabular-nums">{formatCurrency(c.importe)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={confirmarPrefactura}
                      disabled={confirmandoPrefactura || seleccionadas.size === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#00E676] text-black hover:bg-[#00c765] disabled:opacity-40"
                    >
                      {confirmandoPrefactura ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Confirmar seleccionados ({seleccionadas.size})
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1F1F1F]">
                      {['Fecha', 'Cliente', 'CUPS', 'Tipo', ...(facturado ? ['Nº factura'] : []), 'Importe'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map(f => (
                      <tr key={f.id} className="border-b border-[#1A1A1A] last:border-0">
                        <td className="px-4 py-2.5 text-[#9CA3AF] text-xs whitespace-nowrap">{formatDate(f.fecha)}</td>
                        <td className="px-4 py-2.5 text-white text-sm whitespace-nowrap">{f.cliente?.nombre ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-[#9CA3AF] whitespace-nowrap">{f.cups ?? '—'}</td>
                        <td className="px-4 py-2.5 text-[#9CA3AF] text-xs">{TIPO_LABELS[f.tipo] ?? f.tipo}</td>
                        {facturado && (
                          <td className="px-4 py-2.5 text-[#9CA3AF] text-xs whitespace-nowrap">{f.numero_factura ?? '—'}</td>
                        )}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2 justify-end">
                            {f.verificado_prefactura && (
                              <span
                                title={`Verificado contra prefactura${f.prefactura_num ? ' ' + f.prefactura_num : ''}${f.verificado_en ? ' · ' + formatDate(f.verificado_en) : ''}`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              >
                                <ShieldCheck className="w-3 h-3" />
                              </span>
                            )}
                            {facturado
                              ? <span className="text-sm tabular-nums text-[#E5E7EB]">{formatCurrency(f.importe)}</span>
                              : <InlineEditImporte value={f.importe} onSave={v => updateImporte(f.id, v)} />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totales */}
              <div className="px-5 py-4 border-t border-[#1F1F1F] grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  { label: 'Base imponible', value: base },
                  { label: `IVA (${IVA_PCT}%)`, value: iva },
                  { label: 'Total', value: total },
                  { label: `Retención (${retencionPct}%)`, value: -retencion },
                  { label: 'Total neto', value: neto, highlight: true },
                ].map(t => (
                  <div key={t.label}>
                    <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">{t.label}</p>
                    <p className={`text-lg font-bold tabular-nums ${t.highlight ? 'text-[#00E676]' : 'text-white'}`}>
                      {formatCurrency(t.value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
