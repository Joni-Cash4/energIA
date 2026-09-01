'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Wallet, Loader2, Check, CalendarClock, Upload, ShieldCheck, AlertTriangle } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/lib/use-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { conciliarPrefactura, type ResultadoConciliacion, type CuotaPendiente } from '@/lib/prefacturas'
import type { ComisionCobro, EmpresaPago } from '@/types'

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
  const [empresasPago, setEmpresasPago] = useState<EmpresaPago[]>([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<'pendientes' | 'todos'>('pendientes')
  const [marcando, setMarcando] = useState<string | null>(null)

  const [empresaPagoId, setEmpresaPagoId] = useState<string>('')
  const [subiendoPrefactura, setSubiendoPrefactura] = useState(false)
  const [prefacturaExtraida, setPrefacturaExtraida] = useState<{ numero_prefactura: string | null; path: string } | null>(null)
  const [resultado, setResultado] = useState<ResultadoConciliacion | null>(null)
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [confirmando, setConfirmando] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = getSupabaseClient()

    // Solo MOSTRAR. Los cobros NO se auto-generan aquí: se crean de forma
    // deliberada cuando un contrato se activa (verificado contra el portal de
    // Próxima), no al abrir la página. Auto-generar recreaba cobros de
    // contratos aún pendientes/en trámite (el estado heredado no es fiable).
    // Consultas separadas + cruce en JS para no depender del embed FK.
    type ComRow = {
      id: string; cups?: string; comercializadora?: string; empresa_pago_id?: string
      cliente?: { id: string; nombre?: string; empresa?: string } | null
    }
    const [{ data: cobrosRaw }, { data: comsRaw }, { data: empresasRaw }] = await Promise.all([
      supabase.from('comision_cobros').select('*').order('fecha_prevista', { ascending: true }),
      supabase.from('comisiones_generadas').select('id, cups, comercializadora, empresa_pago_id, cliente:clientes(id, nombre, empresa)'),
      supabase.from('empresas_pago').select('*').eq('activo', true),
    ])
    const comById = new Map((comsRaw as unknown as ComRow[] ?? []).map(c => [c.id, c]))
    const enriquecidos = (cobrosRaw ?? []).map((cb: Record<string, unknown>) => ({
      ...cb,
      comision: comById.get(cb.comision_id as string) ?? null,
    }))
    setCobros(enriquecidos as unknown as ComisionCobro[])
    setEmpresasPago((empresasRaw ?? []) as EmpresaPago[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Empresa pagadora por defecto: la que tenga más cuotas pendientes ahora
  // mismo (no hardcodeado a ninguna en concreto — hay varias que facturan:
  // Geoatlanter, Gaolania, Escandinava, Soillik).
  useEffect(() => {
    if (empresaPagoId || empresasPago.length === 0) return
    const conteo = new Map<string, number>()
    for (const c of cobros) {
      if (c.cobrado || !c.comision?.empresa_pago_id) continue
      conteo.set(c.comision.empresa_pago_id, (conteo.get(c.comision.empresa_pago_id) ?? 0) + 1)
    }
    const masFrecuente = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    setEmpresaPagoId(masFrecuente ?? empresasPago.find(e => e.es_default)?.id ?? empresasPago[0].id)
  }, [cobros, empresasPago, empresaPagoId])

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

  function cuotasPendientesDe(empId: string, hastaMes: string): CuotaPendiente[] {
    // Solo cuotas ya vencidas o del mismo mes que la prefactura — una cuota
    // futura (aún no facturada por la empresa pagadora) no es "riesgo" por no
    // aparecer todavía, es lo esperado (cada prefactura cubre una cuota).
    return cobros
      .filter(c => !c.cobrado && c.comision?.empresa_pago_id === empId && c.fecha_prevista.slice(0, 7) <= hastaMes)
      .map(c => ({
        id: c.id,
        importe: c.importe,
        fecha_prevista: c.fecha_prevista,
        clienteNombre: c.comision?.cliente?.nombre,
        clienteEmpresa: c.comision?.cliente?.empresa,
        cups: c.comision?.cups,
        comercializadora: c.comision?.comercializadora,
      }))
  }

  async function handleSubirPrefactura(file: File) {
    setSubiendoPrefactura(true)
    setResultado(null)
    setPrefacturaExtraida(null)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('empresaPagoId', empresaPagoId)
      const res = await fetch('/api/prefactura/upload', { method: 'POST', body })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: json.error ?? 'Error al analizar la prefactura', variant: 'destructive' })
        return
      }
      setPrefacturaExtraida({ numero_prefactura: json.extraido.numero_prefactura, path: json.path })
      const hastaMes: string = json.extraido.fecha?.slice(0, 7) || mesActual()
      const r = conciliarPrefactura(json.extraido.lineas, cuotasPendientesDe(empresaPagoId, hastaMes))
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

  function toggleSeleccion(cuotaId: string) {
    setSeleccionadas(p => {
      const next = new Set(p)
      if (next.has(cuotaId)) next.delete(cuotaId)
      else next.add(cuotaId)
      return next
    })
  }

  async function confirmarSeleccionados() {
    if (!resultado || !prefacturaExtraida) return
    setConfirmando(true)
    const supabase = getSupabaseClient()
    const aConfirmar = resultado.matches.filter(m => m.cuota && seleccionadas.has(m.cuota.id))
    const nowISO = new Date().toISOString()
    const resultados = await Promise.all(aConfirmar.map(m => supabase.from('comision_cobros').update({
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
        : `${aConfirmar.length} cuota(s) verificada(s) contra la prefactura`,
      variant: fallos ? 'destructive' : undefined,
    })
    setResultado(null)
    setPrefacturaExtraida(null)
    setSeleccionadas(new Set())
    await load()
    setConfirmando(false)
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

      {/* Verificar prefactura */}
      <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-5 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-[#00E676]" />
          <h2 className="text-white font-semibold text-sm">Verificar prefactura</h2>
        </div>
        <p className="text-[#6B7280] text-xs mb-4">
          Sube la prefactura que te manda la empresa pagadora y compárala automáticamente contra el calendario. No marca nada como cobrado — solo deja constancia de que se ha cotejado.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-64">
            <label className="block text-[10px] text-[#9CA3AF] mb-1 uppercase tracking-wide">Empresa pagadora</label>
            <Select value={empresaPagoId} onValueChange={setEmpresaPagoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent>
                {empresasPago.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-[10px] text-[#9CA3AF] mb-1 uppercase tracking-wide">Prefactura (PDF o foto)</label>
            <input
              type="file" accept="application/pdf,image/*" capture="environment"
              disabled={subiendoPrefactura || !empresaPagoId}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleSubirPrefactura(f); e.target.value = '' }}
              className="block text-[10px] text-[#9CA3AF] file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-[#1A1A1A] file:text-[#9CA3AF] file:text-[10px] hover:file:bg-[#2A2A2A]"
            />
          </div>
          {subiendoPrefactura && (
            <p className="text-[10px] text-[#6B7280] flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />Analizando prefactura...
            </p>
          )}
        </div>

        {resultado && (
          <div className="mt-5 space-y-4 border-t border-[#1F1F1F] pt-4">
            {prefacturaExtraida?.numero_prefactura && (
              <p className="text-xs text-[#9CA3AF]">Prefactura <span className="text-white font-medium">{prefacturaExtraida.numero_prefactura}</span></p>
            )}

            {resultado.matches.filter(m => m.estado === 'confirmado').length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#00E676] font-semibold mb-1.5">Coinciden</p>
                <div className="space-y-1">
                  {resultado.matches.filter(m => m.estado === 'confirmado').map(m => (
                    <label key={m.lineaIndex} className="flex items-center gap-2 text-xs text-[#E5E7EB] bg-[#00E676]/5 border border-[#00E676]/20 rounded-lg px-3 py-1.5">
                      <input type="checkbox" checked={seleccionadas.has(m.cuota!.id)} onChange={() => toggleSeleccion(m.cuota!.id)} />
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
                      <input type="checkbox" checked={seleccionadas.has(m.cuota!.id)} onChange={() => toggleSeleccion(m.cuota!.id)} />
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
                <p className="text-[10px] uppercase tracking-wide text-[#6B7280] font-semibold mb-1.5">En la prefactura, sin cuota conocida</p>
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
                  <AlertTriangle className="w-3 h-3" />Previstas pero no aparecen en la prefactura
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
                onClick={confirmarSeleccionados}
                disabled={confirmando || seleccionadas.size === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#00E676] text-black hover:bg-[#00c765] disabled:opacity-40"
              >
                {confirmando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Confirmar seleccionados ({seleccionadas.size})
              </button>
            </div>
          </div>
        )}
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
                            {f.verificado_prefactura && (
                              <span
                                title={`Verificado contra prefactura${f.prefactura_num ? ' ' + f.prefactura_num : ''}${f.verificado_en ? ' · ' + formatDate(f.verificado_en) : ''}`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 mr-1.5"
                              >
                                <ShieldCheck className="w-3 h-3" />Verificada
                              </span>
                            )}
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
