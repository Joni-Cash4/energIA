'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Wallet, Loader2, Check, CalendarClock } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/lib/use-toast'
import type { ComisionCobro } from '@/types'

function nombreMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
function hoyISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function CobrosPage() {
  const { toast } = useToast()
  const [cobros, setCobros] = useState<ComisionCobro[]>([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<'pendientes' | 'todos'>('pendientes')
  const [marcando, setMarcando] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = getSupabaseClient()

    // Solo MOSTRAR. Los cobros NO se auto-generan aquí: se crean de forma
    // deliberada cuando un contrato se activa (verificado contra el portal de
    // Próxima), no al abrir la página. Auto-generar recreaba cobros de
    // contratos aún pendientes/en trámite (el estado heredado no es fiable).
    // Consultas separadas + cruce en JS para no depender del embed FK.
    type ComRow = {
      id: string; cups?: string; comercializadora?: string
      cliente?: { id: string; nombre?: string; empresa?: string } | null
    }
    const [{ data: cobrosRaw }, { data: comsRaw }] = await Promise.all([
      supabase.from('comision_cobros').select('*').order('fecha_prevista', { ascending: true }),
      supabase.from('comisiones_generadas').select('id, cups, comercializadora, cliente:clientes(id, nombre, empresa)'),
    ])
    const comById = new Map((comsRaw as unknown as ComRow[] ?? []).map(c => [c.id, c]))
    const enriquecidos = (cobrosRaw ?? []).map((cb: Record<string, unknown>) => ({
      ...cb,
      comision: comById.get(cb.comision_id as string) ?? null,
    }))
    setCobros(enriquecidos as unknown as ComisionCobro[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const visibles = useMemo(
    () => (vista === 'pendientes' ? cobros.filter(c => !c.cobrado) : cobros),
    [cobros, vista]
  )

  const grupos = useMemo(() => {
    const map = new Map<string, ComisionCobro[]>()
    for (const c of visibles) {
      const mes = c.fecha_prevista.slice(0, 7)
      if (!map.has(mes)) map.set(mes, [])
      map.get(mes)!.push(c)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [visibles])

  const totalPendiente = useMemo(() => cobros.filter(c => !c.cobrado).reduce((s, c) => s + c.importe, 0), [cobros])
  const totalCobrado = useMemo(() => cobros.filter(c => c.cobrado).reduce((s, c) => s + c.importe, 0), [cobros])
  const esteMes = useMemo(() => {
    const m = mesActual()
    return cobros.filter(c => !c.cobrado && c.fecha_prevista.slice(0, 7) === m).reduce((s, c) => s + c.importe, 0)
  }, [cobros])

  async function toggleCobrado(c: ComisionCobro) {
    setMarcando(c.id)
    const supabase = getSupabaseClient()
    const nuevo = !c.cobrado
    const fecha_cobro = nuevo ? hoyISO() : null
    const { error } = await supabase.from('comision_cobros')
      .update({ cobrado: nuevo, fecha_cobro }).eq('id', c.id)
    if (error) toast({ title: 'Error al actualizar', variant: 'destructive' })
    else setCobros(p => p.map(x => x.id === c.id ? { ...x, cobrado: nuevo, fecha_cobro: fecha_cobro ?? undefined } : x))
    setMarcando(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-[#00E676]/30 border-t-[#00E676] animate-spin" />
      </div>
    )
  }

  const hoy = hoyISO()

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-[#00E676]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Calendario de cobros</h1>
            <p className="text-[#6B7280] text-sm">Cuándo cobras cada comisión (Próxima fracciona los pagos según importe)</p>
          </div>
        </div>
        <div className="flex rounded-lg border border-[#1F1F1F] bg-[#141414] p-0.5">
          {(['pendientes', 'todos'] as const).map(v => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                vista === v ? 'bg-[#00E676] text-black' : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              {v === 'pendientes' ? 'Pendientes' : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Pendiente de cobro', value: totalPendiente, highlight: true },
          { label: 'Previsto este mes', value: esteMes },
          { label: 'Cobrado (histórico)', value: totalCobrado },
        ].map(t => (
          <div key={t.label} className="bg-[#141414] border border-[#1F1F1F] rounded-2xl px-5 py-4">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">{t.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${t.highlight ? 'text-[#00E676]' : 'text-white'}`}>
              {formatCurrency(t.value)}
            </p>
          </div>
        ))}
      </div>

      {grupos.length === 0 && (
        <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl py-20 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#1F1F1F] flex items-center justify-center">
            <CalendarClock className="w-6 h-6 text-[#6B7280]" />
          </div>
          <p className="text-[#6B7280] text-sm">
            {vista === 'pendientes' ? 'No hay cobros pendientes.' : 'Todavía no hay cobros en el calendario.'}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {grupos.map(([mes, filas]) => {
          const totalMes = filas.reduce((s, f) => s + f.importe, 0)
          const esPasado = mes < mesActual()
          return (
            <div key={mes} className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1F1F1F] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-white font-semibold">{nombreMes(mes)}</h2>
                  {mes === mesActual() && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#00E676] bg-[#00E676]/10 border border-[#00E676]/20 rounded px-1.5 py-0.5">Este mes</span>
                  )}
                </div>
                <p className="text-[#9CA3AF] text-sm tabular-nums">{filas.length} cobro{filas.length === 1 ? '' : 's'} · <span className="text-white font-semibold">{formatCurrency(totalMes)}</span></p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1F1F1F]">
                      {['Vencimiento', 'Cliente', 'Comercializadora', 'Pago', 'Importe', 'Estado'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map(f => {
                      const vencido = !f.cobrado && f.fecha_prevista < hoy
                      return (
                        <tr key={f.id} className="border-b border-[#1A1A1A] last:border-0">
                          <td className="px-4 py-2.5 text-[#9CA3AF] text-xs whitespace-nowrap">
                            {formatDate(f.fecha_prevista)}
                            {vencido && <span className="ml-2 text-red-400 text-[10px] font-semibold uppercase">Vencido</span>}
                          </td>
                          <td className="px-4 py-2.5 text-white text-sm whitespace-nowrap">{f.comision?.cliente?.nombre ?? '—'}</td>
                          <td className="px-4 py-2.5 text-[#9CA3AF] text-xs whitespace-nowrap">{f.comision?.comercializadora ?? '—'}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {f.total_pagos > 1
                              ? <span className="text-xs text-[#E5E7EB]">{f.num_pago}/{f.total_pagos} <span className="text-[#6B7280]">fracc.</span></span>
                              : <span className="text-xs text-[#6B7280]">Único</span>}
                          </td>
                          <td className="px-4 py-2.5 text-sm tabular-nums text-[#E5E7EB] whitespace-nowrap">{formatCurrency(f.importe)}</td>
                          <td className="px-4 py-2.5">
                            <button
                              onClick={() => toggleCobrado(f)}
                              disabled={marcando === f.id}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                f.cobrado
                                  ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 hover:bg-[#00E676]/20'
                                  : 'bg-[#1F1F1F] text-[#9CA3AF] border border-[#2A2A2A] hover:text-white'
                              }`}
                            >
                              {marcando === f.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Check className={`w-3 h-3 ${f.cobrado ? '' : 'opacity-40'}`} />}
                              {f.cobrado ? `Cobrado ${f.fecha_cobro ? formatDate(f.fecha_cobro) : ''}` : 'Marcar cobrado'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {esPasado && filas.some(f => !f.cobrado) && (
                <div className="px-5 py-2 text-[11px] text-red-400/80 border-t border-[#1F1F1F]">Mes cerrado con cobros aún pendientes.</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
