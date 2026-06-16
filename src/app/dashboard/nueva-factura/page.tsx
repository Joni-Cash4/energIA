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
import type { InvoiceAnalysis, SimTarifa } from '@/types'

// El fee de Jonathan se suma SIEMPRE encima del precio de la tarifa (indexada o fija) —
// es su comisión, no un margen ya incluido en el precio publicado de Atulado/Próxima.
function applyFee(sim: SimTarifa, feeKwh: number, kwhTotal: number): SimTarifa {
  const baseIeeAntes = Math.round((sim.subtotal - sim.alquiler) * 100) / 100
  const tipoIee       = baseIeeAntes > 0 ? sim.iee / baseIeeAntes : 0
  const cargo_gestion = Math.round(kwhTotal * feeKwh * 100) / 100
  const delta         = cargo_gestion - sim.cargo_gestion
  const baseIeeNueva  = Math.round((baseIeeAntes + delta) * 100) / 100
  const iee           = Math.round(baseIeeNueva * tipoIee * 100) / 100
  const subtotal      = Math.round((baseIeeNueva + sim.alquiler) * 100) / 100
  const base_iva      = Math.round((subtotal + iee) * 100) / 100
  const iva           = Math.round(base_iva * sim.iva_pct * 100) / 100
  const total         = Math.round((base_iva + iva) * 100) / 100
  return { ...sim, cargo_gestion, subtotal, iee, base_iva, iva, total }
}

async function generatePdf(
  data: InvoiceAnalysis,
  simIdx: SimTarifa,
  simFija: SimTarifa,
  fijaLabel: string,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const M = 12
  let y = 0

  const C = {
    dark:  [10, 10, 10]    as [number,number,number],
    green: [0, 200, 100]   as [number,number,number],
    blue:  [30, 120, 220]  as [number,number,number],
    gray:  [110, 110, 110] as [number,number,number],
    light: [245, 245, 245] as [number,number,number],
    white: [255, 255, 255] as [number,number,number],
    text:  [30, 30, 30]    as [number,number,number],
  }

  const fc = (n: number) => formatCurrency(n)

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...C.dark)
  doc.rect(0, 0, W, 28, 'F')
  doc.setTextColor(...C.green)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('IAenergia', M, 11)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 200, 200)
  doc.text('Informe comparativo de factura electrica', M, 19)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, W - M, 19, { align: 'right' })
  y = 36

  // ── Datos suministro ────────────────────────────────────────────────────────
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.gray)
  doc.text('DATOS DEL SUMINISTRO', M, y)
  y += 5
  const info: [string, string][] = [
    ['CUPS',            data.cups ?? '—'],
    ['Tarifa de acceso', data.tarifa ?? '—'],
    ['Periodo',         `${data.fecha_inicio ?? '—'}  a  ${data.fecha_fin ?? '—'}  (${data.dias_facturados ?? '?'} dias)`],
    ['Consumo total',   `${formatNumber(data.kwh_total)} kWh`],
    ['Comercializadora actual', data.comercializadora ?? '—'],
  ]
  info.forEach(([lbl, val]) => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.gray)
    doc.text(lbl, M, y)
    doc.setTextColor(...C.text)
    doc.text(val, 68, y)
    y += 5
  })
  y += 3

  // ── Resumen 3 columnas ───────────────────────────────────────────────────────
  const bW = (W - M * 2 - 8) / 3
  const boxes = [
    { label: 'FACTURA ACTUAL', total: data.total_factura, sub: 'Lo que pagas ahora', color: C.gray },
    { label: 'TARIFA INDEXADA', total: simIdx.total, sub: data.mercado_actual_mwh ? `Mercado periodo: ${data.mercado_actual_mwh} EUR/MWh` : 'Mercado del periodo facturado', color: C.green },
    { label: `TARIFA FIJA (${fijaLabel})`, total: simFija.total, sub: `IVA ${Math.round(simFija.iva_pct * 100)}%`, color: C.blue },
  ]
  boxes.forEach(({ label, total, sub, color }, i) => {
    const x = M + i * (bW + 4)
    doc.setFillColor(...C.light)
    doc.roundedRect(x, y, bW, 22, 2, 2, 'F')
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...color)
    doc.text(label, x + 3, y + 6)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.text)
    doc.text(fc(total), x + 3, y + 15)
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.gray)
    doc.text(sub, x + 3, y + 20)
  })
  y += 28

  // Ahorro badges
  const ahorroIdx  = Math.round((data.total_factura - simIdx.total) * 100) / 100
  const ahorroFija = Math.round((data.total_factura - simFija.total) * 100) / 100
  const badge = (x: number, ahorro: number, label: string) => {
    const isPos = ahorro >= 0
    doc.setFillColor(...(isPos ? [225, 255, 240] : [255, 230, 230]) as [number,number,number])
    doc.roundedRect(x, y, bW, 10, 2, 2, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(isPos ? [0, 140, 70] : [180, 40, 40]) as [number,number,number])
    doc.text(
      `${label}: ${isPos ? 'Ahorro ' : 'Coste adicional '} ${fc(Math.abs(ahorro))}`,
      x + 3, y + 6.5
    )
  }
  badge(M + bW + 4, ahorroIdx, 'Indexada vs actual')
  badge(M + (bW + 4) * 2, ahorroFija, 'Fija vs actual')
  y += 16

  // ── Tabla comparativa detallada ──────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.gray)
  doc.text('DETALLE COMPARATIVO', M, y)
  y += 6

  const colW = [66, 35, 35, 35]
  const colX = [M, M+66, M+66+35, M+66+35+35]

  doc.setFillColor(...C.dark)
  doc.rect(M, y, W - M * 2, 7, 'F')
  doc.setFontSize(7)
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  ;['Concepto', 'Tarifa actual', 'Indexada', `Fija (${fijaLabel})`].forEach((h, i) => {
    doc.text(h, colX[i] + 2, y + 5)
  })
  y += 7

  let rowAlt = false
  const row = (label: string, actual: number | null, idx: number | null, fija: number | null, bold = false) => {
    if (rowAlt) { doc.setFillColor(250, 250, 250); doc.rect(M, y, W - M * 2, 6.5, 'F') }
    rowAlt = !rowAlt
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.text)
    doc.text(label, colX[0] + 2, y + 4.5)
    if (actual != null) doc.text(fc(actual),  colX[1] + colW[1] - 2, y + 4.5, { align: 'right' })
    if (idx   != null) { doc.setTextColor(...C.green); doc.text(fc(idx),   colX[2] + colW[2] - 2, y + 4.5, { align: 'right' }) }
    if (fija  != null) { doc.setTextColor(...C.blue);  doc.text(fc(fija),  colX[3] + colW[3] - 2, y + 4.5, { align: 'right' }) }
    doc.setTextColor(...C.text)
    y += 6.5
  }

  const divider = () => {
    doc.setDrawColor(210, 210, 210)
    doc.line(M, y, W - M, y)
    y += 1.5
  }

  const energiaActual = (data.periodos ?? []).reduce((s, p) => s + (p.importe ?? 0), 0)
  const potenciaActual = data.potencia_total ?? 0
  const reactivaActual = data.reactiva_total ?? 0
  const alquilerActual = data.alquiler_equipos ?? 0
  const productosActual = data.productos_total ?? 0

  row('Energia (todos los periodos)', Math.round(energiaActual * 100) / 100, simIdx.energia, simFija.energia)
  row('Potencia contratada', potenciaActual || null, simIdx.potencia || null, simFija.potencia || null)
  if (reactivaActual > 0) row('Energia reactiva', reactivaActual, simIdx.reactiva, simFija.reactiva)
  if (productosActual > 0) row('Otros conceptos (regularizaciones, etc.)', productosActual, null, null)
  if (simIdx.otros_costes > 0) row('Otros costes regulados', null, simIdx.otros_costes, null)
  divider()
  row('Subtotal antes de impuestos', null, simIdx.subtotal, simFija.subtotal, true)
  divider()
  row(`Impuesto electricidad`, data.importe_iee ?? null, simIdx.iee, simFija.iee)
  if (alquilerActual > 0) row('Alquiler equipos de medida', alquilerActual, simIdx.alquiler, simFija.alquiler)
  divider()
  row('Base imponible', null, simIdx.base_iva, simFija.base_iva, true)
  row(`IVA (${Math.round(simIdx.iva_pct * 100)}% / ${Math.round(simFija.iva_pct * 100)}%)`, data.importe_iva ?? null, simIdx.iva, simFija.iva)

  y += 1
  doc.setFillColor(...C.dark)
  doc.rect(M, y, W - M * 2, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...C.white)
  doc.text('TOTAL FACTURA', colX[0] + 2, y + 5.5)
  doc.text(fc(data.total_factura), colX[1] + colW[1] - 2, y + 5.5, { align: 'right' })
  doc.setTextColor(...C.green)
  doc.text(fc(simIdx.total),  colX[2] + colW[2] - 2, y + 5.5, { align: 'right' })
  doc.setTextColor(...C.blue)
  doc.text(fc(simFija.total), colX[3] + colW[3] - 2, y + 5.5, { align: 'right' })
  y += 12

  // ── Detalle por periodos (indexada) ──────────────────────────────────────────
  if (y < 230 && (data.periodos ?? []).length > 0) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.gray)
    doc.text('PRECIO POR PERIODO — TARIFA INDEXADA (mercado del periodo facturado)', M, y)
    y += 5

    doc.setFillColor(...C.dark)
    doc.rect(M, y, W - M * 2, 6, 'F')
    doc.setFontSize(7)
    doc.setTextColor(...C.white)
    const ph = ['Periodo', 'kWh', 'Precio actual EUR/kWh', 'del cual mercado', 'Precio indexado']
    ph.forEach((h, i) => doc.text(h, M + 2 + i * 37, y + 4))
    y += 6

    ;(data.periodos ?? []).forEach((p, idx) => {
      if (idx % 2 === 0) { doc.setFillColor(...C.light); doc.rect(M, y, W - M * 2, 6, 'F') }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...C.text)
      const vals = [
        p.periodo,
        formatNumber(p.kwh ?? 0),
        formatNumber(p.precio_kwh, 4),
        formatNumber(p.mercado_kwh ?? 0, 4),
        formatNumber(p.precio_kwh_nuevo ?? 0, 4),
      ]
      vals.forEach((v, i) => doc.text(v, M + 2 + i * 37, y + 4))
      y += 6
    })
    y += 3
  }

  if (!data.mercado_historico_ok && y < 270) {
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...C.gray)
    doc.text('* Mercado del periodo facturado no disponible — se ha usado una estimacion.', M, y)
    y += 5
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  doc.setFillColor(...C.dark)
  doc.rect(0, 285, W, 12, 'F')
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(150, 150, 150)
  doc.text(
    'IAenergia — iaenergia.es  |  Indexada calculada con PERD x (PMD+SC+CAP) del periodo facturado + peajes/cargos BOE. Fija segun tarifa vigente. No constituye oferta vinculante.',
    W / 2, 289, { align: 'center' }
  )
  doc.text(
    `Impuestos calculados con el tipo efectivo real de tu factura actual (IEE ${formatNumber((data.tipo_iee_detectado ?? 0) * 100, 2)}% / IVA ${formatNumber((data.tipo_iva_detectado ?? 0) * 100, 0)}%).`,
    W / 2, 293, { align: 'center' }
  )

  return doc.output('blob')
}

export default function NuevaFacturaPage() {
  const { toast } = useToast()
  const [loading, setLoading]       = useState(false)
  const [data, setData]             = useState<InvoiceAnalysis | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [feeEnergia, setFeeEnergia] = useState(5)    // €/MWh
  const [fijaProducto, setFijaProducto] = useState<'BOE' | 'WEB' | null>(null)
  const [savingPdf, setSavingPdf]   = useState(false)
  const [savingCliente, setSavingCliente] = useState(false)
  const [error, setError]           = useState<string | null>(null)

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
      setFijaProducto(null) // usar la recomendación automática del servidor
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

  // Producto fijo activo: el seleccionado manualmente o la recomendación automática
  const productoActivo = fijaProducto ?? data?.atulado_recomendado ?? 'BOE'

  const simIdx = useMemo(() => {
    if (!data?.sim_indexada) return null
    const feeKwh = feeEnergia / 1000
    return applyFee(data.sim_indexada, feeKwh, data.kwh_total ?? 0)
  }, [data, feeEnergia])

  const simFija = useMemo(() => {
    if (!data) return null
    const base = productoActivo === 'WEB' ? data.sim_fija_web : data.sim_fija_boe
    if (!base) return null
    const feeKwh = feeEnergia / 1000
    return applyFee(base, feeKwh, data.kwh_total ?? 0)
  }, [data, productoActivo, feeEnergia])

  const handleDownloadPdf = async () => {
    if (!data || !simIdx || !simFija) return
    setSavingPdf(true)
    try {
      const blob = await generatePdf(data, simIdx, simFija, `Atulado ${productoActivo}`)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
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
          <button className="ml-auto underline text-xs" onClick={() => { setError(null); setPendingFiles([]) }}>Reintentar</button>
        </div>
      )}

      <AnimatePresence>
        {data && simIdx && simFija && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#00E676]" />
                </div>
                <div>
                  <p className="text-white font-medium">{data.cups}</p>
                  <p className="text-[#6B7280] text-sm">
                    {data.comercializadora} · {data.tarifa} · {data.potencia_contratada} kW · {data.kwh_total} kWh · {data.dias_facturados} días
                  </p>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => { setData(null); setError(null); setPendingFiles([]) }}>Cargar otra</Button>
            </div>

            {!data.mercado_historico_ok && (
              <div className="text-xs text-yellow-500 mb-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
                ⚠ No se pudo obtener el precio de mercado del periodo exacto de la factura — se usó una estimación. Revisar antes de enviar al cliente.
              </div>
            )}
            {data.potencias_desglosadas === false && (
              <div className="text-xs text-yellow-500 mb-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
                ⚠ La IA no pudo leer la potencia contratada por periodo y se ha asumido el mismo kW en todos los periodos ({data.potencia_contratada} kW). Si la potencia varía por periodo (típico en 3.0TD), el cálculo de potencia indexada/fija tendrá error. Revisar la factura manualmente.
              </div>
            )}

            {/* 3 cards comparativas */}
            <div className="grid sm:grid-cols-3 gap-4 mb-4">
              <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-5">
                <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Factura actual</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(data.total_factura)}</p>
                <p className="text-[#6B7280] text-xs mt-2">{data.comercializadora}</p>
              </div>
              <div className="bg-[#141414] border border-[#00E676]/30 rounded-xl p-5">
                <p className="text-[#00E676] text-xs uppercase tracking-wide mb-1">Tarifa indexada</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(simIdx.total)}</p>
                <p className={cn('text-xs mt-2 font-semibold', data.total_factura - simIdx.total >= 0 ? 'text-[#00E676]' : 'text-red-400')}>
                  {data.total_factura - simIdx.total >= 0 ? 'Ahorras ' : 'Coste adicional '}{formatCurrency(Math.abs(data.total_factura - simIdx.total))}
                </p>
              </div>
              <div className="bg-[#141414] border border-blue-500/30 rounded-xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-blue-400 text-xs uppercase tracking-wide">Tarifa fija</p>
                  <div className="flex gap-1">
                    {(['BOE', 'WEB'] as const).map((prod) => (
                      <button
                        key={prod}
                        onClick={() => setFijaProducto(prod)}
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded',
                          productoActivo === prod ? 'bg-blue-500 text-white' : 'bg-[#1A1A1A] text-[#6B7280]'
                        )}
                      >
                        {prod}{data.atulado_recomendado === prod ? ' ★' : ''}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{formatCurrency(simFija.total)}</p>
                <p className={cn('text-xs mt-2 font-semibold', data.total_factura - simFija.total >= 0 ? 'text-[#00E676]' : 'text-red-400')}>
                  {data.total_factura - simFija.total >= 0 ? 'Ahorras ' : 'Coste adicional '}{formatCurrency(Math.abs(data.total_factura - simFija.total))}
                </p>
              </div>
            </div>

            {/* Nota mercado */}
            <div className="text-xs text-[#6B7280] mb-6 bg-[#141414] border border-[#1F1F1F] rounded-xl px-4 py-3">
              Indexada calculada con mercado OMIE del <span className="text-white">periodo exacto de la factura</span> ({data.mercado_actual_mwh} €/MWh medio) + SC + CAP + pérdidas (PERD).
              Impuestos: IEE <span className="text-white">{formatNumber((data.tipo_iee_detectado ?? 0) * 100, 2)}%</span> / IVA <span className="text-white">{formatNumber((data.tipo_iva_detectado ?? 0) * 100, 0)}%</span> — calculados con el tipo efectivo real de tu factura actual.
              Tarifa fija: <span className="text-white">{productoActivo}</span> {data.atulado_recomendado === productoActivo ? '(recomendado automáticamente según tu ratio kWh/kW)' : ''}.
              <br />
              SC/CAP/PERD: fuente{' '}
              <span className={cn(
                'font-semibold',
                data.mercado_real_fuente === 'supabase' ? 'text-[#00E676]' : 'text-yellow-500'
              )}>
                {data.mercado_real_fuente === 'supabase' ? 'real (sincronizado ESIOS)' : data.mercado_real_fuente === 'hardcoded' ? 'confirmada manualmente' : 'estimación regulatoria por defecto'}
              </span>
              {data.mercado_real_fuente !== 'supabase' && ' — margen de error mayor en la indexada hasta sincronizar PERD real.'}
            </div>

            {/* Tabla comparativa detallada */}
            <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-[#1F1F1F]">
                <h2 className="text-white font-semibold">Desglose comparativo</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1F1F1F]">
                      <th className="px-4 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide">Concepto</th>
                      <th className="px-4 py-3 text-right text-xs text-[#6B7280] uppercase tracking-wide">Actual</th>
                      <th className="px-4 py-3 text-right text-xs text-[#00E676] uppercase tracking-wide">Indexada</th>
                      <th className="px-4 py-3 text-right text-xs text-blue-400 uppercase tracking-wide">Fija ({productoActivo})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F1F1F]">
                    {[
                      {
                        label: 'Energía',
                        actual: (data.periodos ?? []).reduce((s, p) => s + (p.importe ?? 0), 0),
                        idx: simIdx.energia,
                        fija: simFija.energia,
                      },
                      { label: 'Potencia', actual: data.potencia_total ?? 0, idx: simIdx.potencia, fija: simFija.potencia },
                      ...(( data.reactiva_total ?? 0) > 0 ? [{ label: 'Reactiva', actual: data.reactiva_total ?? 0, idx: simIdx.reactiva, fija: simFija.reactiva }] : []),
                      ...((data.productos_total ?? 0) > 0 ? [{ label: 'Otros conceptos (regularizaciones, etc.)', actual: data.productos_total ?? 0, idx: null as number | null, fija: null as number | null }] : []),
                      ...(simIdx.otros_costes > 0 ? [{ label: 'Otros costes regulados', actual: null as number | null, idx: simIdx.otros_costes, fija: null as number | null }] : []),
                      { label: `Impuesto electricidad`, actual: data.importe_iee ?? null, idx: simIdx.iee, fija: simFija.iee },
                      ...((data.alquiler_equipos ?? 0) > 0 ? [{ label: 'Alquiler contador', actual: data.alquiler_equipos ?? 0, idx: simIdx.alquiler, fija: simFija.alquiler }] : []),
                      { label: `IVA`, actual: data.importe_iva ?? null, idx: simIdx.iva, fija: simFija.iva },
                    ].map(({ label, actual, idx, fija }) => (
                      <tr key={label} className="hover:bg-[#1A1A1A]">
                        <td className="px-4 py-3 text-[#9CA3AF]">{label}</td>
                        <td className="px-4 py-3 text-right text-white">{actual != null ? formatCurrency(actual) : '—'}</td>
                        <td className="px-4 py-3 text-right text-[#00E676]">{idx != null ? formatCurrency(idx) : '—'}</td>
                        <td className="px-4 py-3 text-right text-blue-400">{fija != null ? formatCurrency(fija) : '—'}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#1A1A1A] font-bold">
                      <td className="px-4 py-3 text-white">TOTAL</td>
                      <td className="px-4 py-3 text-right text-white">{formatCurrency(data.total_factura)}</td>
                      <td className="px-4 py-3 text-right text-[#00E676]">{formatCurrency(simIdx.total)}</td>
                      <td className="px-4 py-3 text-right text-blue-400">{formatCurrency(simFija.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Honorarios (solo vista interna) */}
            <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6 mb-6">
              <h2 className="text-white font-semibold mb-1">Honorarios asesor <span className="text-xs text-[#6B7280] font-normal ml-2">(no aparece en PDF del cliente)</span></h2>
              <p className="text-[#6B7280] text-xs mb-5">Se suma como cargo por gestión sobre ambas tarifas (indexada y fija) — es tu comisión, no un margen ya incluido en el precio publicado.</p>
              <div className="flex items-end gap-6">
                <div>
                  <label className="block text-sm text-[#9CA3AF] mb-2">Fee energía (€/MWh)</label>
                  <Input
                    type="number"
                    value={feeEnergia}
                    onChange={(e) => setFeeEnergia(Number(e.target.value))}
                    min={0}
                    step={0.5}
                    className="w-40"
                  />
                </div>
                <div className="bg-[#1A1A1A] rounded-xl px-5 py-3 text-center">
                  <p className="text-[#6B7280] text-xs mb-0.5">Honorario este periodo</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(simIdx.cargo_gestion)}</p>
                </div>
                <div className="bg-[#00E676]/5 border border-[#00E676]/20 rounded-xl px-5 py-3 text-center">
                  <p className="text-[#6B7280] text-xs mb-0.5">Estimado anual</p>
                  <p className="text-xl font-bold text-[#00E676]">{formatCurrency(simIdx.cargo_gestion * 12)}</p>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleDownloadPdf} disabled={savingPdf} className="gap-2">
                {savingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Generar PDF comparativo
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
