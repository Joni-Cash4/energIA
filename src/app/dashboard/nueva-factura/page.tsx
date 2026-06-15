'use client'
import { useState, useCallback, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, Download, Save, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { processInvoice } from '@/lib/api'
import { getSupabaseClient } from '@/lib/supabase'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { useToast } from '@/lib/use-toast'
import type { InvoiceAnalysis } from '@/types'

// Recalculate savings dynamically based on current fee inputs
function calcSavings(data: InvoiceAnalysis, feeEnergia: number, feePotencia: number) {
  // Fee charged to client reduces net savings
  const feeEnergiaKwh = feeEnergia / 1000 // €/MWh → €/kWh
  const feeMensualEnergia = (data.kwh_total ?? 0) * feeEnergiaKwh
  const feeMensualPotencia = (data.potencia_contratada ?? 0) * (feePotencia / 12)
  const feeMensual = feeMensualEnergia + feeMensualPotencia
  const feeAnual = feeMensual * 12

  // Gross savings from switching tariff (fixed % from API)
  const ahorroBrutoMensual = data.ahorro_estimado_mensual ?? 0
  const ahorroBrutoAnual = data.ahorro_estimado_anual ?? 0

  // Net savings for client after fee
  const ahorroNetoMensual = Math.max(0, ahorroBrutoMensual - feeMensual)
  const ahorroNetoAnual = Math.max(0, ahorroBrutoAnual - feeAnual)
  const porcentaje = data.total_factura > 0
    ? Math.round((ahorroNetoMensual / data.total_factura) * 100)
    : 0

  // Updated periodos with new prices including fee
  const periodos = (data.periodos ?? []).map((p) => ({
    ...p,
    precio_kwh_nuevo: p.precio_kwh_nuevo !== null && p.precio_kwh_nuevo !== undefined
      ? Math.round((p.precio_kwh_nuevo + feeEnergiaKwh) * 10000) / 10000
      : null,
    importe_nuevo: p.importe_nuevo !== null && p.importe_nuevo !== undefined
      ? Math.round((p.importe_nuevo + (p.kwh ?? 0) * feeEnergiaKwh) * 100) / 100
      : null,
  }))

  return { feeMensual, feeAnual, ahorroNetoMensual, ahorroNetoAnual, porcentaje, periodos }
}

async function generatePdfClient(
  data: InvoiceAnalysis,
  feeEnergia: number,
  feePotencia: number,
  savings: ReturnType<typeof calcSavings>
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const margin = 15
  let y = 20

  const green = [0, 230, 118] as [number, number, number]
  const dark = [10, 10, 10] as [number, number, number]
  const gray = [107, 114, 128] as [number, number, number]

  // Header bar
  doc.setFillColor(...dark)
  doc.rect(0, 0, W, 30, 'F')
  doc.setTextColor(...green)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('IAenergía', margin, 12)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 200, 200)
  doc.text('Informe de análisis de factura eléctrica', margin, 20)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, W - margin, 20, { align: 'right' })

  y = 40
  // Client info
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('DATOS DEL SUMINISTRO', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...gray)
  const info = [
    ['CUPS', data.cups ?? '—'],
    ['Comercializadora', data.comercializadora ?? '—'],
    ['Tarifa', data.tarifa ?? '—'],
    ['Potencia contratada', `${data.potencia_contratada ?? '—'} kW`],
    ['Periodo', `${data.fecha_inicio ?? '—'} — ${data.fecha_fin ?? '—'}`],
  ]
  info.forEach(([label, value]) => {
    doc.setTextColor(...gray)
    doc.text(label, margin, y)
    doc.setTextColor(30, 30, 30)
    doc.text(value, 70, y)
    y += 5
  })

  y += 6
  // Savings summary boxes
  doc.setFillColor(240, 255, 248)
  doc.roundedRect(margin, y, (W - margin * 2 - 5) / 2, 22, 3, 3, 'F')
  doc.setFillColor(245, 245, 245)
  doc.roundedRect(margin + (W - margin * 2 - 5) / 2 + 5, y, (W - margin * 2 - 5) / 2, 22, 3, 3, 'F')

  doc.setFontSize(8)
  doc.setTextColor(...gray)
  doc.text('AHORRO MENSUAL ESTIMADO', margin + 4, y + 6)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 180, 90)
  doc.text(formatCurrency(savings.ahorroNetoMensual), margin + 4, y + 16)

  const x2 = margin + (W - margin * 2 - 5) / 2 + 9
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...gray)
  doc.text('AHORRO ANUAL ESTIMADO', x2, y + 6)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 180, 90)
  doc.text(formatCurrency(savings.ahorroNetoAnual), x2, y + 16)

  y += 30

  // Periodos table
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30, 30, 30)
  doc.text('COMPARATIVA POR PERIODOS', margin, y)
  y += 6

  const cols = ['Periodo', 'kWh', 'Precio actual', 'Importe actual', 'Precio nuevo + fee', 'Importe nuevo', 'Ahorro']
  const colW = [18, 18, 28, 28, 35, 28, 20]
  let cx = margin

  doc.setFillColor(30, 30, 30)
  doc.rect(margin, y - 4, W - margin * 2, 7, 'F')
  doc.setFontSize(7)
  doc.setTextColor(200, 200, 200)
  cols.forEach((c, i) => {
    doc.text(c, cx + 1, y)
    cx += colW[i]
  })
  y += 4

  savings.periodos.forEach((p, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(250, 250, 250)
      doc.rect(margin, y - 3, W - margin * 2, 7, 'F')
    }
    cx = margin
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', 'normal')
    const ahorro = (p.importe ?? 0) - (p.importe_nuevo ?? 0)
    const row = [
      p.periodo,
      formatNumber(p.kwh ?? 0),
      `${formatNumber(p.precio_kwh, 4)} €/kWh`,
      formatCurrency(p.importe ?? 0),
      `${formatNumber(p.precio_kwh_nuevo ?? 0, 4)} €/kWh`,
      formatCurrency(p.importe_nuevo ?? 0),
      ahorro > 0 ? formatCurrency(ahorro) : '—',
    ]
    row.forEach((val, i) => {
      if (i === 6 && ahorro > 0) doc.setTextColor(0, 160, 80)
      else doc.setTextColor(30, 30, 30)
      doc.text(val, cx + 1, y)
      cx += colW[i]
    })
    y += 7
  })

  y += 8
  // Fee section
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30, 30, 30)
  doc.text('HONORARIOS DEL ASESOR', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...gray)
  doc.text(`Fee energía: ${feeEnergia} €/MWh · Fee potencia: ${feePotencia} €/kW/año`, margin, y)
  y += 5
  doc.text(`Honorario mensual estimado: ${formatCurrency(savings.feeMensual)} · Anual: ${formatCurrency(savings.feeAnual)}`, margin, y)

  // Footer
  doc.setFillColor(...dark)
  doc.rect(0, 287 - 12, W, 12, 'F')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text('IAenergía — iaenergia.es · Este informe es orientativo y no constituye oferta vinculante.', W / 2, 287 - 5, { align: 'center' })

  return doc.output('blob')
}

export default function NuevaFacturaPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<InvoiceAnalysis | null>(null)
  const [feeEnergia, setFeeEnergia] = useState(5)
  const [feePotencia, setFeePotencia] = useState(1)
  const [savingPdf, setSavingPdf] = useState(false)
  const [savingCliente, setSavingCliente] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return
    setError(null)
    setLoading(true)
    try {
      const result = await processInvoice(files[0])
      setData(result)
    } catch {
      setError('No se pudo procesar la factura. Verifica que el PDF sea válido.')
    }
    setLoading(false)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1, disabled: loading || !!data,
  })

  // Recalculate live whenever fees change
  const savings = useMemo(
    () => data ? calcSavings(data, feeEnergia, feePotencia) : null,
    [data, feeEnergia, feePotencia]
  )

  const handleDownloadPdf = async () => {
    if (!data || !savings) return
    setSavingPdf(true)
    try {
      const blob = await generatePdfClient(data, feeEnergia, feePotencia, savings)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `EnergIA_${data.cups || 'informe'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'PDF descargado correctamente' })
    } catch (e) {
      console.error(e)
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
              <p className="text-[#00E676]">Analizando factura con IA...</p>
              <p className="text-[#6B7280] text-sm">Puede tardar unos segundos</p>
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
          <button className="ml-auto underline text-xs" onClick={() => setError(null)}>Reintentar</button>
        </div>
      )}

      <AnimatePresence>
        {data && savings && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
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
              <Button variant="secondary" size="sm" onClick={() => { setData(null); setError(null) }}>Cargar otra</Button>
            </div>

            {/* Summary cards — live with fees */}
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Factura actual', value: formatCurrency(data.total_factura), sub: `${formatNumber(data.kwh_total)} kWh · ${data.potencia_contratada} kW` },
                { label: 'Ahorro mensual neto', value: formatCurrency(savings.ahorroNetoMensual), accent: true, sub: `Incluye fee asesor` },
                { label: 'Ahorro anual neto', value: formatCurrency(savings.ahorroNetoAnual), accent: true, sub: `${savings.porcentaje}% menos en energía` },
              ].map((c) => (
                <div key={c.label} className={cn('bg-[#141414] border rounded-xl p-5', c.accent ? 'border-[#00E676]/30' : 'border-[#1F1F1F]')}>
                  <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-2">{c.label}</p>
                  <p className={cn('text-2xl font-bold', c.accent ? 'text-[#00E676]' : 'text-white')}>{c.value}</p>
                  {c.sub && <p className="text-[#6B7280] text-xs mt-1">{c.sub}</p>}
                </div>
              ))}
            </div>

            {/* Periodos table — live */}
            <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-[#1F1F1F]">
                <h2 className="text-white font-semibold">Comparativa por periodos</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1F1F1F]">
                      {['Periodo', 'kWh', 'Precio actual', 'Importe actual', 'Precio nuevo + fee', 'Importe nuevo', 'Ahorro'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {savings.periodos.map((p) => {
                      const ahorro = (p.importe ?? 0) - (p.importe_nuevo ?? 0)
                      return (
                        <tr key={p.periodo} className="border-b border-[#1F1F1F] last:border-0 hover:bg-[#1A1A1A]">
                          <td className="px-4 py-3 font-medium text-white">{p.periodo}</td>
                          <td className="px-4 py-3 text-[#9CA3AF]">{formatNumber(p.kwh ?? 0)}</td>
                          <td className="px-4 py-3 text-[#9CA3AF]">{formatNumber(p.precio_kwh, 4)} €/kWh</td>
                          <td className="px-4 py-3 text-white">{formatCurrency(p.importe ?? 0)}</td>
                          <td className="px-4 py-3 text-[#9CA3AF]">{formatNumber(p.precio_kwh_nuevo ?? 0, 4)} €/kWh</td>
                          <td className="px-4 py-3 text-white">{formatCurrency(p.importe_nuevo ?? 0)}</td>
                          <td className="px-4 py-3 font-semibold text-[#00E676]">
                            {ahorro > 0 ? formatCurrency(ahorro) : '—'}
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
              <h2 className="text-white font-semibold mb-1">Configurar honorarios</h2>
              <p className="text-[#6B7280] text-xs mb-5">El ahorro mostrado arriba se actualiza automáticamente al cambiar estos valores.</p>
              <div className="grid sm:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm text-[#9CA3AF] mb-2">Fee energía (€/MWh)</label>
                  <Input type="number" value={feeEnergia} onChange={(e) => setFeeEnergia(Number(e.target.value))} min={0} step={0.5} />
                </div>
                <div>
                  <label className="block text-sm text-[#9CA3AF] mb-2">Fee potencia (€/kW/año)</label>
                  <Input type="number" value={feePotencia} onChange={(e) => setFeePotencia(Number(e.target.value))} min={0} step={0.1} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-[#1A1A1A] rounded-xl p-4 text-center">
                  <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Honorario mensual</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(savings.feeMensual)}</p>
                </div>
                <div className="bg-[#00E676]/5 border border-[#00E676]/20 rounded-xl p-4 text-center">
                  <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Honorario anual</p>
                  <p className="text-2xl font-bold text-[#00E676]">{formatCurrency(savings.feeAnual)}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleDownloadPdf} disabled={savingPdf} className="gap-2">
                {savingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Generar PDF
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
