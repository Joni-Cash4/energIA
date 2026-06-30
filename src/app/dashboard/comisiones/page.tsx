'use client'
import { useEffect, useState, useCallback } from 'react'
import { Receipt, AlertTriangle, TrendingUp, Euro, Pencil, Check, X } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/use-toast'

// ── tipos ────────────────────────────────────────────────────────────────────
type ContratoRaw = {
  id: string
  cliente_id: string | null
  comercializadora: string | null
  tarifa: string | null
  fecha_alta: string | null
  fecha_vencimiento: string | null
  kwh_base_comision: number | null
  fee_energia_mwh: number | null
  reparto_energia: number | null
  a_cobrar: number | null
  clientes: { nombre: string; empresa: string | null } | null
}

type FacturaRaw = {
  cliente_id: string
  kwh_total: number | null
  fecha_inicio: string | null
}

type Estado = 'sin_base' | 'sin_datos' | 'seguimiento' | 'ok' | 'revisar' | 'reclamar'

type ContratoMetrics = ContratoRaw & {
  kwhAcumulado: number
  mesesActivos: number
  proyeccionAnual: number
  desviacionPct: number
  reclamable: number
  estado: Estado
}

// ── helpers ───────────────────────────────────────────────────────────────────
function mesesEntre(desde: string, hasta: Date = new Date()): number {
  const d = new Date(desde)
  return Math.max(0,
    (hasta.getFullYear() - d.getFullYear()) * 12 + (hasta.getMonth() - d.getMonth())
  )
}

function calcEstado(meses: number, desviacionPct: number, base: number | null, kwh: number): Estado {
  if (!base) return 'sin_base'
  if (kwh === 0) return 'sin_datos'
  if (meses < 6) return 'seguimiento'
  if (meses >= 10 && desviacionPct > 5) return 'reclamar'
  if (meses >= 6 && desviacionPct > 8) return 'revisar'
  return 'ok'
}

const ESTADO_CFG: Record<Estado, { label: string; variant: 'red' | 'yellow' | 'default' | 'secondary'; icon?: boolean }> = {
  sin_base:    { label: 'Sin base',    variant: 'secondary' },
  sin_datos:   { label: 'Sin facturas', variant: 'secondary' },
  seguimiento: { label: 'Seguimiento', variant: 'default' },
  ok:          { label: 'OK',          variant: 'default' },
  revisar:     { label: 'Revisar',     variant: 'yellow', icon: true },
  reclamar:    { label: 'Reclamar',    variant: 'red', icon: true },
}

// ── componente inline-edit ────────────────────────────────────────────────────
function InlineEdit({
  value, onSave, suffix, min = 0, step = 1
}: {
  value: number | null; onSave: (v: number) => Promise<void>; suffix: string; min?: number; step?: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(String(value ?? '')); setEditing(true) }}
        className="flex items-center gap-1 text-sm tabular-nums hover:text-white text-[#9CA3AF] transition-colors group"
      >
        {value != null ? `${formatNumber(value, 0)} ${suffix}` : <span className="text-[#4B5563] italic">— añadir</span>}
        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        min={min}
        step={step}
        className="h-7 w-28 text-xs px-2"
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

// ── página ────────────────────────────────────────────────────────────────────
export default function ComisionesPage() {
  const { toast } = useToast()
  const [contratos, setContratos] = useState<ContratoMetrics[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = getSupabaseClient()

    const [{ data: rawContratos }, { data: rawFacturas }] = await Promise.all([
      supabase
        .from('contratos')
        .select('id,cliente_id,comercializadora,tarifa,fecha_alta,fecha_vencimiento,kwh_base_comision,fee_energia_mwh,reparto_energia,a_cobrar,clientes(nombre,empresa)')
        .eq('estado', 'activo')
        .not('fecha_alta', 'is', null)
        .order('fecha_alta', { ascending: false }),
      supabase
        .from('facturas')
        .select('cliente_id,kwh_total,fecha_inicio')
        .not('kwh_total', 'is', null),
    ])

    const facturasPorCliente: Record<string, FacturaRaw[]> = {}
    for (const f of (rawFacturas ?? []) as FacturaRaw[]) {
      if (!f.cliente_id) continue
      if (!facturasPorCliente[f.cliente_id]) facturasPorCliente[f.cliente_id] = []
      facturasPorCliente[f.cliente_id].push(f)
    }

    const hoy = new Date()
    const metrics: ContratoMetrics[] = ((rawContratos ?? []) as unknown as ContratoRaw[]).map(c => {
      const mesesActivos = c.fecha_alta ? mesesEntre(c.fecha_alta, hoy) : 0
      const facturas = c.cliente_id ? (facturasPorCliente[c.cliente_id] ?? []) : []

      // Solo facturas después del alta del contrato
      const facturasFiltradas = c.fecha_alta
        ? facturas.filter(f => f.fecha_inicio && f.fecha_inicio >= c.fecha_alta!)
        : facturas

      const kwhAcumulado = facturasFiltradas.reduce((s, f) => s + (f.kwh_total ?? 0), 0)
      const proyeccionAnual = mesesActivos > 0 ? (kwhAcumulado / mesesActivos) * 12 : 0
      const base = c.kwh_base_comision ?? 0
      const desviacionPct = base > 0 ? ((proyeccionAnual - base) / base) * 100 : 0
      const fee = c.fee_energia_mwh ?? 5
      const reparto = c.reparto_energia ?? 1.0
      const diferencia = Math.max(0, proyeccionAnual - base)
      const reclamable = (diferencia * fee / 1000) * reparto

      return {
        ...c,
        kwhAcumulado,
        mesesActivos,
        proyeccionAnual,
        desviacionPct,
        reclamable,
        estado: calcEstado(mesesActivos, desviacionPct, c.kwh_base_comision, kwhAcumulado),
      }
    })

    setContratos(metrics)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const updateContrato = useCallback(async (id: string, fields: Record<string, number | null>) => {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('contratos').update(fields).eq('id', id)
    if (error) { toast({ title: 'Error al guardar', variant: 'destructive' }); return }
    toast({ title: 'Guardado' })
    await load()
  }, [load, toast])

  // ── resumen ──────────────────────────────────────────────────────────────
  const totalReclamable = contratos.filter(c => c.estado === 'reclamar' || c.estado === 'revisar')
    .reduce((s, c) => s + c.reclamable, 0)
  const alertas = contratos.filter(c => c.estado === 'reclamar').length
  const revisiones = contratos.filter(c => c.estado === 'revisar').length
  const monitorizados = contratos.filter(c => c.kwh_base_comision != null).length

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
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center">
          <Receipt className="w-5 h-5 text-[#00E676]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Seguimiento de comisiones</h1>
          <p className="text-[#6B7280] text-sm">Detecta desviaciones entre consumo comisionado y consumo real</p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4">
          <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Monitorizados</p>
          <p className="text-2xl font-bold text-white">{monitorizados}</p>
          <p className="text-[#4B5563] text-xs mt-0.5">de {contratos.length} activos</p>
        </div>
        <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4">
          <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Alertas reclamar</p>
          <p className={`text-2xl font-bold ${alertas > 0 ? 'text-red-400' : 'text-white'}`}>{alertas}</p>
          <p className="text-[#4B5563] text-xs mt-0.5">+5% consumo real ≥ 10 meses</p>
        </div>
        <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4">
          <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Revisar</p>
          <p className={`text-2xl font-bold ${revisiones > 0 ? 'text-yellow-400' : 'text-white'}`}>{revisiones}</p>
          <p className="text-[#4B5563] text-xs mt-0.5">+8% consumo real ≥ 6 meses</p>
        </div>
        <div className="bg-[#0a1a0a] border border-[#00E676]/20 rounded-xl p-4">
          <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Reclamable estimado</p>
          <p className="text-2xl font-bold text-[#00E676]">{formatCurrency(totalReclamable)}</p>
          <p className="text-[#4B5563] text-xs mt-0.5">contratos en revisar + reclamar</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1F1F1F]">
          <h2 className="text-white font-semibold">Contratos activos</h2>
          <p className="text-[#6B7280] text-xs mt-0.5">
            Edita "Base comisión" y "Fee" haciendo clic. Las facturas procesadas acumulan el consumo real automáticamente.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1F1F1F]">
                {['Cliente','Comerc.','Alta','Meses','Base comisión','kWh real acum.','Proyección anual','Desviación','Fee','Estado','Reclamable'].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contratos.map(c => {
                const cfg = ESTADO_CFG[c.estado]
                const progreso = c.kwh_base_comision && c.kwhAcumulado > 0
                  ? Math.min(100, (c.kwhAcumulado / c.kwh_base_comision) * 100)
                  : 0

                return (
                  <tr key={c.id} className={`border-b border-[#1A1A1A] last:border-0 transition-colors hover:bg-[#1A1A1A] ${
                    c.estado === 'reclamar' ? 'bg-red-500/3' : c.estado === 'revisar' ? 'bg-yellow-500/3' : ''
                  }`}>
                    <td className="px-3 py-3">
                      <p className="text-white font-medium text-sm">{c.clientes?.nombre ?? '—'}</p>
                      {c.clientes?.empresa && <p className="text-[#4B5563] text-xs truncate max-w-[120px]">{c.clientes.empresa}</p>}
                    </td>
                    <td className="px-3 py-3 text-[#9CA3AF] text-xs whitespace-nowrap">{c.comercializadora ?? '—'}</td>
                    <td className="px-3 py-3 text-[#9CA3AF] text-xs whitespace-nowrap">{c.fecha_alta ? formatDate(c.fecha_alta) : '—'}</td>
                    <td className="px-3 py-3">
                      <span className="text-white font-medium">{c.mesesActivos}</span>
                      <span className="text-[#4B5563] text-xs"> / 12</span>
                    </td>

                    {/* Base comisión — editable */}
                    <td className="px-3 py-3">
                      <InlineEdit
                        value={c.kwh_base_comision}
                        suffix="kWh"
                        step={100}
                        onSave={v => updateContrato(c.id, { kwh_base_comision: v })}
                      />
                    </td>

                    {/* kWh acumulado real */}
                    <td className="px-3 py-3">
                      {c.kwhAcumulado > 0 ? (
                        <div>
                          <span className="text-white font-medium">{formatNumber(c.kwhAcumulado, 0)}</span>
                          <span className="text-[#4B5563] text-xs"> kWh</span>
                          {c.kwh_base_comision && (
                            <div className="mt-1 w-24 h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  c.desviacionPct > 5 ? 'bg-red-400' : c.desviacionPct > 0 ? 'bg-yellow-400' : 'bg-[#00E676]'
                                }`}
                                style={{ width: `${progreso}%` }}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#4B5563] text-xs italic">Sin facturas</span>
                      )}
                    </td>

                    {/* Proyección anual */}
                    <td className="px-3 py-3">
                      {c.proyeccionAnual > 0 ? (
                        <span className={`font-medium tabular-nums ${c.desviacionPct > 5 ? 'text-red-400' : c.desviacionPct > 0 ? 'text-yellow-400' : 'text-white'}`}>
                          {formatNumber(c.proyeccionAnual, 0)} kWh
                        </span>
                      ) : (
                        <span className="text-[#4B5563] text-xs">—</span>
                      )}
                    </td>

                    {/* Desviación */}
                    <td className="px-3 py-3">
                      {c.kwh_base_comision && c.proyeccionAnual > 0 ? (
                        <span className={`font-bold tabular-nums ${
                          c.desviacionPct > 5 ? 'text-red-400' :
                          c.desviacionPct > 0 ? 'text-yellow-400' :
                          'text-[#00E676]'
                        }`}>
                          {c.desviacionPct > 0 ? '+' : ''}{c.desviacionPct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-[#4B5563] text-xs">—</span>
                      )}
                    </td>

                    {/* Fee — editable */}
                    <td className="px-3 py-3">
                      <InlineEdit
                        value={c.fee_energia_mwh}
                        suffix="€/MWh"
                        step={0.5}
                        onSave={v => updateContrato(c.id, { fee_energia_mwh: v })}
                      />
                    </td>

                    {/* Estado */}
                    <td className="px-3 py-3">
                      <Badge variant={cfg.variant} className="whitespace-nowrap">
                        {cfg.icon && <AlertTriangle className="w-3 h-3 mr-1" />}
                        {cfg.label}
                      </Badge>
                      {c.mesesActivos < 6 && c.kwh_base_comision && c.kwhAcumulado > 0 && (
                        <p className="text-[#4B5563] text-[10px] mt-0.5">alerta activa en mes 6</p>
                      )}
                    </td>

                    {/* Reclamable */}
                    <td className="px-3 py-3">
                      {c.reclamable > 0 ? (
                        <div>
                          <span className={`font-bold tabular-nums ${c.estado === 'reclamar' ? 'text-red-400' : 'text-yellow-400'}`}>
                            {formatCurrency(c.reclamable)}
                          </span>
                          <p className="text-[#4B5563] text-[10px] mt-0.5">
                            {formatNumber(Math.max(0, c.proyeccionAnual - (c.kwh_base_comision ?? 0)), 0)} kWh × {c.fee_energia_mwh ?? 5} €/MWh × {((c.reparto_energia ?? 1) * 100).toFixed(0)}%
                          </p>
                        </div>
                      ) : (
                        <span className="text-[#4B5563] text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {contratos.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-[#4B5563]">
                    No hay contratos activos con fecha de alta registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Leyenda umbrales */}
        <div className="px-5 py-3 border-t border-[#1F1F1F] flex flex-wrap gap-4 text-xs text-[#4B5563]">
          <span><span className="text-[#6B7280]">Seguimiento</span> — &lt; 6 meses activo</span>
          <span><span className="text-yellow-400">Revisar</span> — proyección &gt;8% base · meses 6-9</span>
          <span><span className="text-red-400">Reclamar</span> — proyección &gt;5% base · mes 10+</span>
          <span>Reparto: Próxima 100% · Atulado 95%</span>
        </div>
      </div>
    </div>
  )
}
