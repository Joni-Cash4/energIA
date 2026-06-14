'use client'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, Download, Save, Loader2, AlertCircle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { processInvoice, generatePdf } from '@/lib/api'
import { getSupabaseClient } from '@/lib/supabase'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { useToast } from '@/lib/use-toast'
import type { InvoiceAnalysis } from '@/types'

export default function NuevaFacturaPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<InvoiceAnalysis | null>(null)
  const [feeEnergia, setFeeEnergia] = useState(5)
  const [feePotencia, setFeePotencia] = useState(1)
  const [savingPdf, setSavingPdf] = useState(false)
  const [savingCliente, setSavingCliente] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isDemo, setIsDemo] = useState(false)

  const onDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return
    setError(null)
    setLoading(true)
    try {
      const result = await processInvoice(files[0])
      setIsDemo(!!(result as any)._demo)
      setData(result)
    } catch {
      setError('No se pudo procesar la factura. Verifica que el PDF sea válido.')
    }
    setLoading(false)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1, disabled: loading || !!data,
  })

  const comisionMensual = data ? ((data.kwh_total / 1000) * feeEnergia + data.potencia_contratada * (feePotencia / 12)) : 0
  const comisionAnual = comisionMensual * 12

  const handleDownloadPdf = async () => {
    if (!data) return
    setSavingPdf(true)
    try {
      const blob = await generatePdf(data, feeEnergia, feePotencia)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `EnergIA_${data.cups || 'informe'}.pdf`; a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'PDF descargado correctamente' })
    } catch {
      toast({ title: 'Error al generar PDF', variant: 'destructive' })
    }
    setSavingPdf(false)
  }

  const handleSaveCliente = async () => {
    if (!data) return
    setSavingCliente(true)
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('clientes').insert({
      nombre: data.cups ?? 'Cliente nuevo',
      cups: data.cups,
      comercializadora: data.comercializadora,
      tarifa: data.tarifa,
      estado: 'prospecto',
    })
    if (error) toast({ title: 'Error al guardar cliente', variant: 'destructive' })
    else toast({ title: 'Cliente guardado correctamente' })
    setSavingCliente(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Nueva factura</h1>

      {/* Upload zone */}
      {!data && (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 mb-6',
            isDragActive ? 'border-[#00E676] bg-[#00E676]/5' : 'border-[#2A2A2A] bg-[#141414] hover:border-[#00E676]/50',
            loading && 'opacity-60 cursor-not-allowed'
          )}
        >
          <input {...getInputProps()} />
          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-[#00E676]/30 border-t-[#00E676] animate-spin" />
              <p className="text-[#00E676]">Analizando factura...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-12 h-12 text-[#6B7280]" />
              <p className="text-white font-medium">{isDragActive ? 'Suelta aquí' : 'Arrastra el PDF o haz clic'}</p>
              <p className="text-[#6B7280] text-sm">Factura eléctrica en formato PDF</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm mb-6">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <AnimatePresence>
        {data && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {isDemo && (
              <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400 text-sm mb-6">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Modo demostración — el servidor de análisis PDF no está disponible. Los datos mostrados son de ejemplo. Activa el backend para procesar facturas reales.</span>
              </div>
            )}
            {/* Header info + reset */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#00E676]" />
                </div>
                <div>
                  <p className="text-white font-medium">{data.cups}</p>
                  <p className="text-[#6B7280] text-sm">{data.comercializadora} · {data.tarifa}</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setData(null)}>Cargar otra</Button>
            </div>

            {/* Summary cards */}
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Factura actual', value: formatCurrency(data.total_factura), sub: `${formatNumber(data.kwh_total)} kWh` },
                { label: 'Ahorro mensual', value: formatCurrency(data.ahorro_estimado_mensual), accent: true },
                { label: 'Ahorro anual', value: formatCurrency(data.ahorro_estimado_anual), accent: true, sub: `${data.porcentaje_ahorro.toFixed(0)}% menos` },
              ].map((c) => (
                <div key={c.label} className={cn('bg-[#141414] border rounded-xl p-5', c.accent ? 'border-[#00E676]/30' : 'border-[#1F1F1F]')}>
                  <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-2">{c.label}</p>
                  <p className={cn('text-2xl font-bold', c.accent ? 'text-[#00E676]' : 'text-white')}>{c.value}</p>
                  {c.sub && <p className="text-[#6B7280] text-xs mt-1">{c.sub}</p>}
                </div>
              ))}
            </div>

            {/* Periods table */}
            <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-[#1F1F1F]">
                <h2 className="text-white font-semibold">Comparativa por periodos</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1F1F1F]">
                      {['Periodo', 'kWh', 'Precio actual', 'Importe actual', 'Precio nuevo', 'Importe nuevo', 'Ahorro'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.periodos.map((p) => {
                      const ahorro = (p.importe ?? 0) - (p.importe_nuevo ?? 0)
                      return (
                        <tr key={p.periodo} className="border-b border-[#1F1F1F] last:border-0 hover:bg-[#1A1A1A]">
                          <td className="px-4 py-3 font-medium text-white">{p.periodo}</td>
                          <td className="px-4 py-3 text-[#9CA3AF]">{formatNumber(p.kwh)}</td>
                          <td className="px-4 py-3 text-[#9CA3AF]">{formatNumber(p.precio_kwh, 4)} €/kWh</td>
                          <td className="px-4 py-3 text-white">{formatCurrency(p.importe ?? 0)}</td>
                          <td className="px-4 py-3 text-[#9CA3AF]">{formatNumber(p.precio_kwh_nuevo ?? 0, 4)} €/kWh</td>
                          <td className="px-4 py-3 text-white">{formatCurrency(p.importe_nuevo ?? 0)}</td>
                          <td className="px-4 py-3 font-semibold text-[#00E676]">
                            {ahorro > 0 ? `${formatCurrency(ahorro)}` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fee inputs */}
            <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6 mb-6">
              <h2 className="text-white font-semibold mb-5">Configurar comisión</h2>
              <div className="grid sm:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm text-[#9CA3AF] mb-2">Fee energía (€/MWh)</label>
                  <Input
                    type="number"
                    value={feeEnergia}
                    onChange={(e) => setFeeEnergia(Number(e.target.value))}
                    min={0} step={0.5}
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#9CA3AF] mb-2">Fee potencia (€/kW/año)</label>
                  <Input
                    type="number"
                    value={feePotencia}
                    onChange={(e) => setFeePotencia(Number(e.target.value))}
                    min={0} step={0.1}
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-[#1A1A1A] rounded-xl p-4 text-center">
                  <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Comisión mensual</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(comisionMensual)}</p>
                </div>
                <div className="bg-[#00E676]/5 border border-[#00E676]/20 rounded-xl p-4 text-center">
                  <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Comisión anual</p>
                  <p className="text-2xl font-bold text-[#00E676]">{formatCurrency(comisionAnual)}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleDownloadPdf} disabled={savingPdf} className="gap-2">
                {savingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Generar PDF definitivo
              </Button>
              <Button variant="secondary" onClick={handleSaveCliente} disabled={savingCliente} className="gap-2">
                {savingCliente ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar cliente
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
