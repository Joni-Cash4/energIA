'use client'
import { useState, useCallback, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, Download, Save, Loader2, AlertCircle, X, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { processInvoice } from '@/lib/api'
import { getSupabaseClient } from '@/lib/supabase'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { useToast } from '@/lib/use-toast'
import type { InvoiceAnalysis } from '@/types'

// Recalculate savings dynamically based on current fee inputs
// ahorroBruto = real market comparison (from server). Fee is Jonathan's income charged on top.
// Higher fee → higher Jonathan income → higher client cost → lower client net saving.
function calcSavings(data: InvoiceAnalysis, feeEnergia: number, feePotencia: number) {
  const feeEnergiaKwh = feeEnergia / 1000 // €/MWh → €/kWh
  const feeMensualEnergia = (data.kwh_total ?? 0) * feeEnergiaKwh
  const feeMensualPotencia = (data.potencia_contratada ?? 0) * (feePotencia / 12)
  const feeMensual = Math.round((feeMensualEnergia + feeMensualPotencia) * 100) / 100
  const feeAnual = Math.round(feeMensual * 12 * 100) / 100

  // Gross savings = invoice price vs indexed market (from server, real market data)
  const ahorroBrutoMensual = data.ahorro_estimado_mensual ?? 0

  // Client net saving = gross saving minus what they pay Jonathan
  const ahorroNetoMensual = Math.round((ahorroBrutoMensual - feeMensual) * 100) / 100
  const ahorroNetoAnual = Math.round(ahorroNetoMensual * 12 * 100) / 100
  const porcentaje = data.coste_actual_energia > 0
    ? Math.round((ahorroNetoMensual / data.coste_actual_energia) * 100)
    : 0

  // Add fee to new price per period (fee is on top of indexed market price)
  const periodos = (data.periodos ?? []).map((p) => ({
    ...p,
    precio_kwh_nuevo: p.precio_kwh_nuevo != null
      ? Math.round((p.precio_kwh_nuevo + feeEnergiaKwh) * 10000) / 10000
      : null,
    importe_nuevo: p.importe_nuevo != null
      ? Math.round((p.importe_nuevo + (p.kwh ?? 0) * feeEnergiaKwh) * 100) / 100
      : null,
  }))

  return { feeMensual, feeAnual, ahorroNetoMensual, ahorroNetoAnual, porcentaje, periodos }
}

async function generatePdfClient(
  data: InvoiceAnalysis,
  _feeEnergia: number,
  _feePotencia: number,
  savings: ReturnType<typeof calcSavings>
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const M = 14
  let y = 0

  const C = {
    dark:  [10, 10, 10]   as [number,number,number],
    green: [0, 200, 100]  as [number,number,number],
    gray:  [110, 110, 110] as [number,number,number],
    light: [245, 245, 245] as [number,number,number],
    white: [255, 255, 255] as [number,number,number],
    text:  [30, 30, 30]   as [number,number,number],
  }

  const fc = (n: number) => formatCurrency(n)
  const R = (n: number, d = 2) => formatNumber(n, d)

  // ── Header ──
  doc.setFillColor(...C.dark)
  doc.rect(0, 0, W, 28, 'F')
  doc.setTextColor(...C.green)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('IAenergia', M, 11)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 200, 200)
  doc.text('Informe de analisis de factura electrica', M, 19)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, W - M, 19, { align: 'right' })
  y = 36

  // ── Datos del suministro ──
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.gray)
  doc.text('DATOS DEL SUMINISTRO', M, y)
  y += 5
  const info: [string, string][] = [
    ['CUPS', data.cups ?? '—'],
    ['Comercializadora', data.comercializadora ?? '—'],
    ['Tarifa de acceso', data.tarifa ?? '—'],
    ['Periodo de consumo', `${data.fecha_inicio ?? '—'}  a  ${data.fecha_fin ?? '—'}`],
    ['Consumo total', `${formatNumber(data.kwh_total)} kWh`],
  ]
  info.forEach(([lbl, val]) => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.gray)
    doc.text(lbl, M, y)
    doc.setTextColor(...C.text)
    doc.text(val, 65, y)
    y += 5
  })
  y += 4

  // ── Resumen ahorro ──
  const ahorroM = data.ahorro_estimado_mensual ?? 0
  const ahorroA = data.ahorro_estimado_anual ?? 0
  const isPos = ahorroM >= 0
  const boxW = (W - M * 2 - 4) / 2
  doc.setFillColor(...(isPos ? [235, 255, 245] : [255, 235, 235]) as [number,number,number])
  doc.roundedRect(M, y, boxW, 20, 2, 2, 'F')
  doc.setFillColor(...C.light)
  doc.roundedRect(M + boxW + 4, y, boxW, 20, 2, 2, 'F')

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.gray)
  doc.text('AHORRO MENSUAL ESTIMADO', M + 3, y + 6)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...(isPos ? [0, 160, 80] : [200, 50, 50]) as [number,number,number])
  doc.text((isPos ? '' : '-') + fc(Math.abs(ahorroM)), M + 3, y + 15)

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.gray)
  doc.text('AHORRO ANUAL ESTIMADO', M + boxW + 7, y + 6)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.text)
  doc.text((isPos ? '' : '-') + fc(Math.abs(ahorroA)), M + boxW + 7, y + 15)
  y += 28

  // ── Simulacion de factura ──
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.gray)
  doc.text('SIMULACION DE FACTURA — COMPARATIVA', M, y)

  if (data.mercado_actual_mwh) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(`Mercado PVPC hoy: ${data.mercado_actual_mwh} EUR/MWh  |  Mismos peajes y cargos de su factura actual`, M, y + 5)
    y += 9
  } else {
    y += 5
  }

  // Table header
  const cW = [72, 35, 35, 28] // Concepto | Actual | Indexada | Dif
  const cX = [M, M+72, M+72+35, M+72+35+35]
  doc.setFillColor(...C.dark)
  doc.rect(M, y, W - M*2, 7, 'F')
  doc.setFontSize(7)
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  ;['Concepto', 'Tarifa actual', 'Tarifa indexada', 'Diferencia'].forEach((h, i) => {
    doc.text(h, cX[i] + 2, y + 5)
  })
  y += 7

  const row = (label: string, actual: number | null, nuevo: number | null, bold = false, highlight = false) => {
    const dif = actual != null && nuevo != null ? nuevo - actual : null
    if (highlight) {
      doc.setFillColor(...(isPos ? [235, 255, 245] : [255, 235, 235]) as [number,number,number])
      doc.rect(M, y, W - M*2, 7, 'F')
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.text)
    doc.text(label, cX[0] + 2, y + 5)
    if (actual != null) { doc.setTextColor(...C.text); doc.text(fc(actual), cX[1] + cW[1] - 2, y + 5, { align: 'right' }) }
    if (nuevo != null)  { doc.setTextColor(...C.text); doc.text(fc(nuevo),  cX[2] + cW[2] - 2, y + 5, { align: 'right' }) }
    if (dif != null) {
      doc.setTextColor(...(dif < 0 ? [0,160,80] : dif > 0 ? [200,50,50] : C.gray) as [number,number,number])
      doc.text((dif < 0 ? '-' : dif > 0 ? '+' : '') + fc(Math.abs(dif)), cX[3] + cW[3] - 2, y + 5, { align: 'right' })
    }
    y += 7
  }

  const divider = (label: string) => {
    doc.setFillColor(230, 230, 230)
    doc.rect(M, y, W - M*2, 0.3, 'F')
    y += 1
  }

  // Energy rows per period
  const periodos = data.periodos ?? []
  periodos.forEach((p) => {
    row(
      `Energia ${p.periodo} (${formatNumber(p.kwh ?? 0)} kWh)`,
      p.importe ?? null,
      p.importe_nuevo ?? null
    )
  })

  divider('')
  const potencia = data.potencia_total ?? 0
  const reactiva = data.reactiva_total ?? 0
  const alquiler = data.alquiler_equipos ?? 0
  const energiaActual = periodos.reduce((s, p) => s + (p.importe ?? 0), 0)
  const energiaNueva  = periodos.reduce((s, p) => s + (p.importe_nuevo ?? 0), 0)

  row('Subtotal energia', energiaActual, energiaNueva, true)

  if (potencia > 0) row('Potencia contratada', potencia, potencia)
  if (reactiva > 0) row('Energia reactiva', reactiva, reactiva)

  divider('')
  const subActual = energiaActual + potencia + reactiva
  const subNuevo  = energiaNueva  + potencia + reactiva
  row('Subtotal', subActual, subNuevo, true)

  const ieeA = Math.round(subActual * 0.0511268 * 100) / 100
  const ieeN = Math.round(subNuevo  * 0.0511268 * 100) / 100
  row('Impuesto electricidad (5,11%)', ieeA, ieeN)
  if (alquiler > 0) row('Alquiler equipos de medida', alquiler, alquiler)

  divider('')
  const baseA = subActual + ieeA + alquiler
  const baseN = subNuevo  + ieeN + alquiler
  row('Base imponible', baseA, baseN, true)

  const ivaA = Math.round(baseA * 0.21 * 100) / 100
  const ivaN = Math.round(baseN * 0.21 * 100) / 100
  row('IVA (21%)', ivaA, ivaN)

  y += 1
  doc.setFillColor(...C.dark)
  doc.rect(M, y, W - M*2, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...C.white)
  doc.text('TOTAL FACTURA', cX[0] + 2, y + 5.5)
  doc.text(fc(data.total_factura), cX[1] + cW[1] - 2, y + 5.5, { align: 'right' })
  const totalN = baseN + ivaN
  doc.text(fc(totalN), cX[2] + cW[2] - 2, y + 5.5, { align: 'right' })
  const ahorroPdf = data.total_factura - totalN
  doc.setTextColor(...(ahorroPdf >= 0 ? C.green : [255,100,100]) as [number,number,number])
  doc.text((ahorroPdf < 0 ? '+' : '-') + fc(Math.abs(ahorroPdf)), cX[3] + cW[3] - 2, y + 5.5, { align: 'right' })
  y += 12

  // ── Detalle precio por periodo ──
  if (y < 240) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.gray)
    doc.text('PRECIO POR PERIODO (EUR/kWh)', M, y)
    y += 5
    doc.setFillColor(...C.dark)
    doc.rect(M, y, W - M*2, 6, 'F')
    doc.setFontSize(7)
    doc.setTextColor(...C.white)
    ;['Periodo', 'kWh', 'Precio actual', 'del cual mercado', 'Precio indexado hoy'].forEach((h, i) => {
      doc.text(h, M + 2 + i * 37, y + 4)
    })
    y += 6
    periodos.forEach((p, idx) => {
      if (idx % 2 === 0) { doc.setFillColor(...C.light); doc.rect(M, y, W - M*2, 6, 'F') }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...C.text)
      const vals = [
        p.periodo,
        formatNumber(p.kwh ?? 0),
        R(p.precio_kwh, 4) + ' EUR/kWh',
        R(p.mercado_kwh ?? 0, 4) + ' EUR/kWh',
        R(p.precio_kwh_nuevo ?? 0, 4) + ' EUR/kWh',
      ]
      vals.forEach((v, i) => doc.text(v, M + 2 + i * 37, y + 4))
      y += 6
    })
  }

  // ── Footer ──
  doc.setFillColor(...C.dark)
  doc.rect(0, 285, W, 12, 'F')
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(150, 150, 150)
  doc.text(
    'IAenergia — iaenergia.es  |  Informe orientativo. Precios indexados basados en mercado PVPC del dia de emision. No constituye oferta vinculante.',
    W / 2, 292, { align: 'center' }
  )

  return doc.output('blob')
}

export default function NuevaFacturaPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<InvoiceAnalysis | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [feeEnergia, setFeeEnergia] = useState(5)
  const [feePotencia, setFeePotencia] = useState(1)
  const [savingPdf, setSavingPdf] = useState(false)
  const [savingCliente, setSavingCliente] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((dropped: File[]) => {
    setPendingFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size))
      return [...prev, ...dropped.filter((f) => !existing.has(f.name + f.size))]
    })
  }, [])

  const removeFile = useCallback((idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (pendingFiles.length === 0) return
    setError(null)
    setLoading(true)
    try {
      const result = await processInvoice(pendingFiles)
      setData(result)
    } catch {
      setError('No se pudo procesar la factura. Verifica que los archivos sean válidos.')
    }
    setLoading(false)
  }, [pendingFiles])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    disabled: loading || !!data,
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
        <div className="mb-6 space-y-4">
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300',
              isDragActive ? 'border-[#00E676] bg-[#00E676]/5' : 'border-[#2A2A2A] bg-[#141414] hover:border-[#00E676]/50',
              loading && 'opacity-60 cursor-not-allowed'
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-[#6B7280]" />
              <p className="text-white font-medium">{isDragActive ? 'Suelta aquí' : 'Arrastra archivos o haz clic'}</p>
              <p className="text-[#6B7280] text-sm">PDF, JPG, PNG o WEBP · Puedes añadir varios archivos</p>
            </div>
          </div>

          {/* File list */}
          {pendingFiles.length > 0 && (
            <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl overflow-hidden">
              {pendingFiles.map((f, i) => {
                const isImg = f.type.startsWith('image/')
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[#1F1F1F] last:border-0">
                    {isImg
                      ? <Image className="w-4 h-4 text-[#6B7280] shrink-0" />
                      : <FileText className="w-4 h-4 text-[#6B7280] shrink-0" />
                    }
                    <span className="text-sm text-white flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-[#6B7280] shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => removeFile(i)} className="text-[#6B7280] hover:text-red-400 transition-colors ml-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Analyze button */}
          {pendingFiles.length > 0 && !loading && (
            <Button onClick={handleAnalyze} className="w-full gap-2 glow-green">
              <FileText className="w-4 h-4" />
              Analizar {pendingFiles.length} {pendingFiles.length === 1 ? 'archivo' : 'archivos'} con IA
            </Button>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-10 h-10 rounded-full border-2 border-[#00E676]/30 border-t-[#00E676] animate-spin" />
              <p className="text-[#00E676] text-sm">Analizando con IA... puede tardar unos segundos</p>
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
              <Button variant="secondary" size="sm" onClick={() => { setData(null); setError(null); setPendingFiles([]) }}>Cargar otra</Button>
            </div>

            {/* Summary cards — live with fees */}
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-5">
                <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-2">Factura actual</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(data.total_factura)}</p>
                <p className="text-[#6B7280] text-xs mt-1">{formatNumber(data.kwh_total)} kWh · {data.potencia_contratada} kW</p>
              </div>
              <div className={cn('border rounded-xl p-5', savings.ahorroNetoMensual >= 0 ? 'bg-[#141414] border-[#00E676]/30' : 'bg-[#141414] border-red-500/30')}>
                <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-2">Ahorro mensual neto</p>
                <p className={cn('text-2xl font-bold', savings.ahorroNetoMensual >= 0 ? 'text-[#00E676]' : 'text-red-400')}>
                  {savings.ahorroNetoMensual >= 0 ? '' : '−'}{formatCurrency(Math.abs(savings.ahorroNetoMensual))}
                </p>
                <p className="text-[#6B7280] text-xs mt-1">
                  {savings.ahorroNetoMensual >= 0 ? 'vs mercado actual · incluye fee' : 'Mercado actual más caro que su tarifa'}
                </p>
              </div>
              <div className={cn('border rounded-xl p-5', savings.ahorroNetoAnual >= 0 ? 'bg-[#141414] border-[#00E676]/30' : 'bg-[#141414] border-red-500/30')}>
                <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-2">Ahorro anual neto</p>
                <p className={cn('text-2xl font-bold', savings.ahorroNetoAnual >= 0 ? 'text-[#00E676]' : 'text-red-400')}>
                  {savings.ahorroNetoAnual >= 0 ? '' : '−'}{formatCurrency(Math.abs(savings.ahorroNetoAnual))}
                </p>
                <p className="text-[#6B7280] text-xs mt-1">
                  {Math.abs(savings.porcentaje)}% {savings.porcentaje >= 0 ? 'menos' : 'más'} en energía
                  {data.mercado_actual_mwh ? ` · Mercado hoy: ${data.mercado_actual_mwh} €/MWh` : ''}
                </p>
              </div>
            </div>

            {/* Market context note */}
            {data.mercado_actual_mwh && (
              <div className="text-xs text-[#6B7280] mb-6 bg-[#141414] border border-[#1F1F1F] rounded-xl px-4 py-3">
                Comparativa vs <span className="text-white">tarifa indexada al mercado hoy ({data.mercado_actual_mwh} €/MWh PVPC)</span> + mismos peajes y cargos de su factura.
                {savings.ahorroNetoMensual < 0
                  ? ' El mercado está más caro que lo que pagó este cliente — su tarifa fija le conviene ahora mismo.'
                  : ' Cambiando a tarifa indexada ahorraría esta cantidad a precios de hoy.'}
              </div>
            )}

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
