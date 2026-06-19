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

// El fee de Jonathan se suma siempre encima del precio de tarifa (indexada o fija).
// El tipo IEE se deriva de la factura real y se aplica sobre la nueva base con fee,
// replicando exactamente la mecánica de la factura original (sea % o €/MWh mínimo).
function applyFee(sim: SimTarifa, feeKwh: number, kwhTotal: number): SimTarifa {
  const baseIeeAntes  = Math.round((sim.subtotal - sim.alquiler) * 100) / 100
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

// ─── PDF 4 columnas ─────────────────────────────────────────────────────────────
// Layout A4 portrait: W=210mm, M=10mm → usable=190mm
// col0(concepto)=50, col1-4(datos)=35 cada uno → 50+4×35=190 ✓
async function generatePdf(
  data: InvoiceAnalysis,
  simIdx: SimTarifa,
  simBoe: SimTarifa,
  simWeb: SimTarifa,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const M = 10
  let y = 0

  const C = {
    dark:   [10, 10, 10]    as [number,number,number],
    green:  [0, 190, 95]    as [number,number,number],
    blue:   [30, 120, 220]  as [number,number,number],
    violet: [130, 80, 210]  as [number,number,number],
    gray:   [110, 110, 110] as [number,number,number],
    lgray:  [200, 200, 200] as [number,number,number],
    light:  [245, 245, 245] as [number,number,number],
    white:  [255, 255, 255] as [number,number,number],
    text:   [30, 30, 30]    as [number,number,number],
  }

  const fc = (n: number) => formatCurrency(n)
  const fn = (n: number, d = 4) => formatNumber(n, d)

  // Posiciones de columnas
  const colW = [50, 35, 35, 35, 35] as const
  const colX = [M, M+50, M+85, M+120, M+155] as const

  const rightOf = (i: number) => colX[i] + colW[i]

  // ─── Header ─────────────────────────────────────────────────────────────────
  doc.setFillColor(...C.dark)
  doc.rect(0, 0, W, 28, 'F')
  doc.setTextColor(...C.green)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text('IAenergia', M, 11)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 200, 200)
  doc.text('Informe comparativo de factura electrica', M, 19)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, W - M, 19, { align: 'right' })
  y = 34

  // ─── Datos suministro ────────────────────────────────────────────────────────
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.gray)
  doc.text('DATOS DEL SUMINISTRO', M, y)
  y += 4.5
  const info: [string, string][] = [
    ['CUPS',                 data.cups ?? '—'],
    ['Tarifa de acceso',     data.tarifa ?? '—'],
    ['Periodo facturado',    `${data.fecha_inicio ?? '—'}  a  ${data.fecha_fin ?? '—'}  (${data.dias_facturados ?? '?'} dias)`],
    ['Consumo total',        `${formatNumber(data.kwh_total)} kWh`],
    ['Comercializadora',     data.comercializadora ?? '—'],
  ]
  info.forEach(([lbl, val]) => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.gray)
    doc.text(lbl, M, y)
    doc.setTextColor(...C.text)
    doc.text(val, 63, y)
    y += 4.5
  })
  y += 3

  // ─── 4 boxes resumen ─────────────────────────────────────────────────────────
  // 4 cajas × 45mm + 3 huecos × 3.33mm ≈ 190mm
  const recWeb = data.atulado_recomendado === 'WEB'
  const bW = 45
  const bG = Math.round(((W - 2*M) - 4*bW) / 3)
  const summaries: { label: string; total: number; sub: string; color: [number,number,number] }[] = [
    { label: 'FACTURA ACTUAL',      total: data.total_factura, sub: data.comercializadora ?? '—',  color: C.gray   },
    { label: 'PROXIMA CRISTALINA',  total: simIdx.total,       sub: 'Tarifa indexada mercado',       color: C.green  },
    { label: `ATULADO BOE${recWeb ? '' : '  ★'}`,  total: simBoe.total, sub: 'Tarifa fija BOE', color: C.blue   },
    { label: `ATULADO WEB${recWeb ? '  ★' : ''}`,  total: simWeb.total, sub: 'Tarifa fija WEB', color: C.violet },
  ]
  summaries.forEach(({ label, total, sub, color }, i) => {
    const x = M + i * (bW + bG)
    doc.setFillColor(...C.light)
    doc.roundedRect(x, y, bW, 22, 2, 2, 'F')
    doc.setFontSize(5.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...color)
    doc.text(label, x + 2, y + 5)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.text)
    doc.text(fc(total), x + 2, y + 13.5)
    doc.setFontSize(5.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.gray)
    doc.text(sub, x + 2, y + 19.5)
  })
  y += 25

  // Badges ahorro (bajo las 3 opciones)
  const ahorroLabels = ['Indexada vs actual', 'BOE vs actual', 'WEB vs actual']
  const ahorroSims  = [simIdx, simBoe, simWeb]
  ahorroSims.forEach((s, i) => {
    const ahorro = Math.round((data.total_factura - s.total) * 100) / 100
    const x = M + (bW + bG) * (i + 1)
    const isPos = ahorro >= 0
    doc.setFillColor(...(isPos ? [220, 255, 235] : [255, 225, 225]) as [number,number,number])
    doc.roundedRect(x, y, bW, 8.5, 2, 2, 'F')
    doc.setFontSize(6)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(isPos ? [0, 130, 65] : [180, 40, 40]) as [number,number,number])
    doc.text(
      `${ahorroLabels[i]}: ${isPos ? 'Ahorro ' : '+Coste '}${fc(Math.abs(ahorro))}`,
      x + 2, y + 5.8
    )
  })
  y += 13

  // ─── Tabla comparativa ────────────────────────────────────────────────────────
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.gray)
  doc.text('DETALLE COMPARATIVO', M, y)
  y += 5

  // Cabecera
  doc.setFillColor(...C.dark)
  doc.rect(M, y, W - 2*M, 7, 'F')
  doc.setFontSize(6)
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  const colHeaders = ['Concepto', 'Factura actual', 'Proxima Cristalina', 'Atulado BOE', 'Atulado WEB']
  colHeaders.forEach((h, i) => {
    if (i === 0) doc.text(h, colX[0] + 1, y + 4.5)
    else doc.text(h, rightOf(i) - 1, y + 4.5, { align: 'right' })
  })
  y += 7

  // Colores de datos por columna
  const dColors: [number,number,number][] = [C.text, C.green, C.blue, C.violet]

  let rowAlt = false

  const row = (
    label: string,
    vals: (number | null)[],
    bold = false,
  ) => {
    if (rowAlt) { doc.setFillColor(250, 250, 250); doc.rect(M, y, W - 2*M, 6, 'F') }
    rowAlt = !rowAlt
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 7 : 6.5)
    doc.setTextColor(...C.text)
    doc.text(label, colX[0] + 1, y + 4)
    vals.forEach((v, i) => {
      if (v === null) {
        doc.setTextColor(...C.lgray)
        doc.text('—', rightOf(i + 1) - 1, y + 4, { align: 'right' })
      } else {
        doc.setTextColor(...(bold ? (i === 0 ? C.text : dColors[i]) : dColors[i]))
        doc.text(fc(v), rightOf(i + 1) - 1, y + 4, { align: 'right' })
      }
    })
    y += 6
  }

  const divider = () => {
    doc.setFillColor(...C.lgray)
    doc.rect(M, y, W - 2*M, 0.4, 'F')
    y += 0.4
    rowAlt = false
  }

  const energiaActual = Math.round((data.periodos ?? []).reduce((s, p) => s + (p.importe ?? 0), 0) * 100) / 100
  const subtotalActual = data.base_imponible
    ? Math.round((data.base_imponible - (data.importe_iee ?? 0)) * 100) / 100
    : null

  // Energía total para el cliente: incluye cargo gestión + otros costes regulados
  // (el fee del asesor y los costes pass-through no se muestran como líneas separadas)
  const r2 = (n: number) => Math.round(n * 100) / 100
  const idxEnergiaPdf = r2(simIdx.energia + simIdx.cargo_gestion + simIdx.otros_costes)
  const boeEnergiaPdf = r2(simBoe.energia + simBoe.cargo_gestion + simBoe.otros_costes)
  const webEnergiaPdf = r2(simWeb.energia + simWeb.cargo_gestion + simWeb.otros_costes)

  // kW contratados por periodo (para etiqueta de cada fila)
  const kwPorPeriodo: Record<string, number> = {}
  for (const p of data.potencias ?? []) kwPorPeriodo[p.periodo] = p.kw

  // Filas de potencia — una por periodo
  const potPeriodos = Object.keys(simIdx.potencia_periodos ?? {}).sort()
  for (const p of potPeriodos) {
    const kw = kwPorPeriodo[p]
    const label = kw != null ? `  ${p}  ${formatNumber(kw, 0)} kW` : `  ${p}`
    row(label,
      [null, simIdx.potencia_periodos![p] ?? null, simBoe.potencia_periodos![p] ?? null, simWeb.potencia_periodos![p] ?? null])
  }
  // Total potencia (aquí sí aparece el importe real de la factura)
  row('Total potencia',
    [data.potencia_total ?? null, simIdx.potencia, simBoe.potencia, simWeb.potencia],
    true)

  row('Energia activa (todos los periodos)',
    [energiaActual, idxEnergiaPdf, boeEnergiaPdf, webEnergiaPdf])

  if ((data.reactiva_total ?? 0) > 0) {
    row('Energia reactiva',
      [data.reactiva_total ?? null, simIdx.reactiva || null, simBoe.reactiva || null, simWeb.reactiva || null])
  }

  if ((data.alquiler_equipos ?? 0) > 0) {
    row('Alquiler contador / equipos de medida',
      [data.alquiler_equipos ?? null, simIdx.alquiler, simBoe.alquiler, simWeb.alquiler])
  }

  divider()
  row('Subtotal sin impuestos',
    [subtotalActual, simIdx.subtotal, simBoe.subtotal, simWeb.subtotal],
    true)

  row(`Imp. Especial Electricidad (tipo efectivo ${fn((data.tipo_iee_detectado ?? 0) * 100, 2)}%)`,
    [data.importe_iee ?? null, simIdx.iee, simBoe.iee, simWeb.iee])

  divider()
  row('Base imponible (IVA)',
    [data.base_imponible ?? null, simIdx.base_iva, simBoe.base_iva, simWeb.base_iva],
    true)

  row(`IVA (${fn((data.tipo_iva_detectado ?? 0.21) * 100, 0)}%)`,
    [data.importe_iva ?? null, simIdx.iva, simBoe.iva, simWeb.iva])

  // Fila TOTAL
  y += 1
  doc.setFillColor(...C.dark)
  doc.rect(M, y, W - 2*M, 8.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...C.white)
  doc.text('TOTAL FACTURA', colX[0] + 1, y + 5.5)
  const totColors: [number,number,number][] = [C.white, C.green, C.blue, C.violet]
  ;[data.total_factura, simIdx.total, simBoe.total, simWeb.total].forEach((v, i) => {
    doc.setTextColor(...totColors[i])
    doc.text(fc(v), rightOf(i + 1) - 1, y + 5.5, { align: 'right' })
  })
  y += 13

  // ─── Detalle por periodo — tarifa indexada ────────────────────────────────────
  if (y < 220 && (data.periodos ?? []).length > 0) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.gray)
    doc.text('DESGLOSE POR PERIODO DE CONSUMO', M, y)
    y += 4

    // 4 columnas: Periodo | kWh | Precio actual €/kWh | Precio Proxima €/kWh
    const phCols = [20, 30, 70, 70] // anchos relativos
    const phTot  = phCols.reduce((a, b) => a + b, 0)
    const phScale = (W - 2*M) / phTot
    const phX = phCols.reduce<number[]>((acc, w, i) => {
      acc.push(i === 0 ? M : acc[i-1] + phCols[i-1] * phScale)
      return acc
    }, [])

    doc.setFillColor(...C.dark)
    doc.rect(M, y, W - 2*M, 6, 'F')
    doc.setFontSize(6.5)
    doc.setTextColor(...C.white)
    const phHeaders = ['Periodo', 'kWh consumidos', 'Precio actual (EUR/kWh)', 'Precio Proxima Cristalina (EUR/kWh)']
    phHeaders.forEach((h, i) => doc.text(h, phX[i] + 2, y + 4))
    y += 6

    ;(data.periodos ?? []).forEach((p, i) => {
      if (i % 2 === 0) { doc.setFillColor(...C.light); doc.rect(M, y, W - 2*M, 6, 'F') }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...C.text)
      doc.text(p.periodo,                       phX[0] + 2, y + 4)
      doc.text(formatNumber(p.kwh ?? 0),         phX[1] + 2, y + 4)
      doc.text(fn(p.precio_kwh),                 phX[2] + 2, y + 4)
      doc.setTextColor(...C.green)
      doc.text(fn(p.precio_kwh_nuevo ?? 0),      phX[3] + 2, y + 4)
      y += 6
    })
    y += 3
  }

  if (!data.mercado_historico_ok && y < 270) {
    doc.setFontSize(6)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...C.gray)
    doc.text('* Precio de mercado del periodo exacto no disponible — se ha usado una estimacion.', M, y)
    y += 4
  }

  // ─── Footer ───────────────────────────────────────────────────────────────────
  doc.setFillColor(...C.dark)
  doc.rect(0, 285, W, 12, 'F')
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(150, 150, 150)
  doc.text(
    'IAenergia — iaenergia.es  |  Proxima Cristalina: PERD×(PMD+SC+CAP) periodo facturado + peajes/cargos BOE 2026. Atulado BOE/WEB: tarifas fijas vigentes. No oferta vinculante.',
    W / 2, 289, { align: 'center' }
  )
  doc.text(
    `IEE tipo efectivo real ${fn((data.tipo_iee_detectado ?? 0)*100, 2)}%  •  IVA ${fn((data.tipo_iva_detectado ?? 0.21)*100, 0)}%  •  PERD: ${data.mercado_real_fuente === 'supabase' ? 'ESIOS real' : data.mercado_real_fuente === 'hardcoded' ? 'confirmado' : 'estimacion regulatoria'}`,
    W / 2, 293, { align: 'center' }
  )

  return doc.output('blob')
}

// ─── Page component ───────────────────────────────────────────────────────────
export default function NuevaFacturaPage() {
  const { toast } = useToast()
  const [loading, setLoading]         = useState(false)
  const [data, setData]               = useState<InvoiceAnalysis | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [feeEnergia, setFeeEnergia]   = useState(5)  // €/MWh
  const [savingPdf, setSavingPdf]     = useState(false)
  const [savingCliente, setSavingCliente] = useState(false)
  const [error, setError]             = useState<string | null>(null)

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

  const feeKwh = feeEnergia / 1000

  const simIdx = useMemo(() => {
    if (!data?.sim_indexada) return null
    return applyFee(data.sim_indexada, feeKwh, data.kwh_total ?? 0)
  }, [data, feeKwh])

  const simBoe = useMemo(() => {
    if (!data?.sim_fija_boe) return null
    return applyFee(data.sim_fija_boe, feeKwh, data.kwh_total ?? 0)
  }, [data, feeKwh])

  const simWeb = useMemo(() => {
    if (!data?.sim_fija_web) return null
    return applyFee(data.sim_fija_web, feeKwh, data.kwh_total ?? 0)
  }, [data, feeKwh])

  const handleDownloadPdf = async () => {
    if (!data || !simIdx || !simBoe || !simWeb) return
    setSavingPdf(true)
    try {
      const blob = await generatePdf(data, simIdx, simBoe, simWeb)
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
    const { error: err } = await supabase.from('clientes').insert({
      nombre: data.cups ?? 'Cliente nuevo',
      cups: data.cups,
      comercializadora: data.comercializadora,
      tarifa: data.tarifa,
      estado: 'prospecto',
    })
    if (err) toast({ title: 'Error al guardar cliente', variant: 'destructive' })
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
        {data && simIdx && simBoe && simWeb && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

            {/* Cabecera */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#00E676]" />
                </div>
                <div>
                  <p className="text-white font-medium">{data.cups}</p>
                  <p className="text-[#6B7280] text-sm">
                    {data.comercializadora} · {data.tarifa} · {data.potencia_contratada} kW · {formatNumber(data.kwh_total)} kWh · {data.dias_facturados} días
                  </p>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => { setData(null); setError(null); setPendingFiles([]) }}>
                Cargar otra
              </Button>
            </div>

            {!data.mercado_historico_ok && (
              <div className="text-xs text-yellow-500 mb-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
                ⚠ No se pudo obtener el precio de mercado del periodo exacto de la factura — se usó una estimación. Revisar antes de enviar al cliente.
              </div>
            )}
            {data.potencias_desglosadas === false && (
              <div className="text-xs text-yellow-500 mb-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
                ⚠ La IA no pudo leer la potencia contratada por periodo — se asumió {data.potencia_contratada} kW en todos los periodos. Si varía (típico en 3.0TD), el cálculo de potencia puede tener error. Revisar manualmente.
              </div>
            )}

            {/* 4 tarjetas comparativas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">

              {/* Factura actual */}
              <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">
                <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Factura actual</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(data.total_factura)}</p>
                <p className="text-[#6B7280] text-xs mt-2">{data.comercializadora}</p>
              </div>

              {/* Próxima Cristalina */}
              <div className="bg-[#141414] border border-[#00E676]/30 rounded-xl p-4">
                <p className="text-[#00E676] text-xs uppercase tracking-wide mb-1">Próxima Cristalina</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(simIdx.total)}</p>
                <p className={cn('text-xs mt-2 font-semibold', data.total_factura - simIdx.total >= 0 ? 'text-[#00E676]' : 'text-red-400')}>
                  {data.total_factura - simIdx.total >= 0 ? 'Ahorras ' : '+Coste '}
                  {formatCurrency(Math.abs(data.total_factura - simIdx.total))}
                </p>
              </div>

              {/* Atulado BOE */}
              <div className="bg-[#141414] border border-blue-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-blue-400 text-xs uppercase tracking-wide">Atulado BOE</p>
                  {data.atulado_recomendado !== 'WEB' && (
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">★ Recom.</span>
                  )}
                </div>
                <p className="text-2xl font-bold text-white">{formatCurrency(simBoe.total)}</p>
                <p className={cn('text-xs mt-2 font-semibold', data.total_factura - simBoe.total >= 0 ? 'text-[#00E676]' : 'text-red-400')}>
                  {data.total_factura - simBoe.total >= 0 ? 'Ahorras ' : '+Coste '}
                  {formatCurrency(Math.abs(data.total_factura - simBoe.total))}
                </p>
              </div>

              {/* Atulado WEB */}
              <div className="bg-[#141414] border border-violet-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-violet-400 text-xs uppercase tracking-wide">Atulado WEB</p>
                  {data.atulado_recomendado === 'WEB' && (
                    <span className="text-[10px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded">★ Recom.</span>
                  )}
                </div>
                <p className="text-2xl font-bold text-white">{formatCurrency(simWeb.total)}</p>
                <p className={cn('text-xs mt-2 font-semibold', data.total_factura - simWeb.total >= 0 ? 'text-[#00E676]' : 'text-red-400')}>
                  {data.total_factura - simWeb.total >= 0 ? 'Ahorras ' : '+Coste '}
                  {formatCurrency(Math.abs(data.total_factura - simWeb.total))}
                </p>
              </div>
            </div>

            {/* Nota metodología */}
            <div className="text-xs text-[#6B7280] mb-6 bg-[#141414] border border-[#1F1F1F] rounded-xl px-4 py-3">
              <span className="text-white font-medium">Próxima Cristalina</span>: PERD × (PMD OMIE real + SC + CAP) del periodo facturado + peajes/cargos BOE 2026 + fee gestión + costes regulados.&ensp;
              <span className="text-white font-medium">Atulado BOE / WEB</span>: tarifas fijas vigentes (precios toda hora incluidos).&ensp;
              IEE <span className="text-white">{formatNumber((data.tipo_iee_detectado ?? 0) * 100, 2)}%</span> y IVA <span className="text-white">{formatNumber((data.tipo_iva_detectado ?? 0.21) * 100, 0)}%</span> derivados del tipo efectivo real de tu factura.&ensp;
              SC/CAP/PERD fuente{' '}
              <span className={cn('font-semibold', data.mercado_real_fuente === 'supabase' ? 'text-[#00E676]' : 'text-yellow-500')}>
                {data.mercado_real_fuente === 'supabase' ? 'real (sincronizado ESIOS)' : data.mercado_real_fuente === 'hardcoded' ? 'confirmada manualmente' : 'estimación regulatoria por defecto'}
              </span>
              {data.mercado_real_fuente === 'fallback' && ' — margen de error mayor en la indexada hasta sincronizar PERD real.'}
            </div>

            {/* Tabla comparativa detallada */}
            <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-[#1F1F1F]">
                <h2 className="text-white font-semibold">Desglose comparativo — todos los conceptos</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[#1F1F1F]">
                      <th className="px-4 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide">Concepto</th>
                      <th className="px-4 py-3 text-right text-xs text-[#6B7280] uppercase tracking-wide">Actual</th>
                      <th className="px-4 py-3 text-right text-xs text-[#00E676] uppercase tracking-wide">Próxima</th>
                      <th className="px-4 py-3 text-right text-xs text-blue-400 uppercase tracking-wide">Atulado BOE</th>
                      <th className="px-4 py-3 text-right text-xs text-violet-400 uppercase tracking-wide">Atulado WEB</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F1F1F]">
                    {/* Potencia — una fila por periodo */}
                    {Object.keys(simIdx.potencia_periodos ?? {}).sort().map((p) => {
                      const kwP = (data.potencias ?? []).find(x => x.periodo === p)
                      return (
                        <TableRow
                          key={`pot-${p}`}
                          label={`Potencia ${p}${kwP ? ` (${formatNumber(kwP.kw, 0)} kW)` : ''}`}
                          actual={null}
                          idx={simIdx.potencia_periodos?.[p] ?? null}
                          boe={simBoe.potencia_periodos?.[p] ?? null}
                          web={simWeb.potencia_periodos?.[p] ?? null}
                        />
                      )
                    })}
                    <tr className="bg-[#1C1C1C]">
                      <td className="px-4 py-2 text-white font-semibold text-xs">Total potencia</td>
                      <td className="px-4 py-2 text-right font-semibold text-white text-sm">{data.potencia_total != null ? formatCurrency(data.potencia_total) : '—'}</td>
                      <td className="px-4 py-2 text-right font-semibold text-[#00E676] text-sm">{formatCurrency(simIdx.potencia)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-blue-400 text-sm">{formatCurrency(simBoe.potencia)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-violet-400 text-sm">{formatCurrency(simWeb.potencia)}</td>
                    </tr>

                    {/* Energía */}
                    <TableRow
                      label="Energía activa (todos los periodos)"
                      actual={(data.periodos ?? []).reduce((s, p) => s + (p.importe ?? 0), 0)}
                      idx={simIdx.energia}
                      boe={simBoe.energia}
                      web={simWeb.energia}
                    />

                    {/* Cargo gestión / fee — solo si hay fee */}
                    {(simIdx.cargo_gestion > 0 || simBoe.cargo_gestion > 0 || simWeb.cargo_gestion > 0) && (
                      <TableRow
                        label="Cargo gestión / fee asesor"
                        actual={null}
                        idx={simIdx.cargo_gestion || null}
                        boe={simBoe.cargo_gestion || null}
                        web={simWeb.cargo_gestion || null}
                      />
                    )}

                    {/* Otros costes regulados (solo indexada) */}
                    {simIdx.otros_costes > 0 && (
                      <TableRow
                        label="Otros costes regulados (FNEE, GO, bono, tasas)"
                        actual={null}
                        idx={simIdx.otros_costes}
                        boe={null}
                        web={null}
                      />
                    )}

                    {/* Reactiva */}
                    {(data.reactiva_total ?? 0) > 0 && (
                      <TableRow
                        label="Energía reactiva"
                        actual={data.reactiva_total ?? null}
                        idx={simIdx.reactiva || null}
                        boe={simBoe.reactiva || null}
                        web={simWeb.reactiva || null}
                      />
                    )}

                    {/* Alquiler */}
                    {(data.alquiler_equipos ?? 0) > 0 && (
                      <TableRow
                        label="Alquiler contador / equipo de medida"
                        actual={data.alquiler_equipos ?? null}
                        idx={simIdx.alquiler}
                        boe={simBoe.alquiler}
                        web={simWeb.alquiler}
                      />
                    )}

                    {/* Subtotal */}
                    <tr className="bg-[#1C1C1C]">
                      <td className="px-4 py-3 text-white font-semibold text-xs uppercase tracking-wide">Subtotal sin impuestos</td>
                      <td className="px-4 py-3 text-right font-semibold text-white text-sm">
                        {data.base_imponible ? formatCurrency(Math.round((data.base_imponible - (data.importe_iee ?? 0)) * 100) / 100) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#00E676] text-sm">{formatCurrency(simIdx.subtotal)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-400 text-sm">{formatCurrency(simBoe.subtotal)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-violet-400 text-sm">{formatCurrency(simWeb.subtotal)}</td>
                    </tr>

                    {/* IEE */}
                    <TableRow
                      label={`Imp. Especial Electricidad (${formatNumber((data.tipo_iee_detectado ?? 0) * 100, 2)}%)`}
                      actual={data.importe_iee ?? null}
                      idx={simIdx.iee}
                      boe={simBoe.iee}
                      web={simWeb.iee}
                    />

                    {/* Base IVA */}
                    <tr className="bg-[#1C1C1C]">
                      <td className="px-4 py-3 text-white font-semibold text-xs uppercase tracking-wide">Base imponible (IVA)</td>
                      <td className="px-4 py-3 text-right font-semibold text-white text-sm">{data.base_imponible ? formatCurrency(data.base_imponible) : '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#00E676] text-sm">{formatCurrency(simIdx.base_iva)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-400 text-sm">{formatCurrency(simBoe.base_iva)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-violet-400 text-sm">{formatCurrency(simWeb.base_iva)}</td>
                    </tr>

                    {/* IVA */}
                    <TableRow
                      label={`IVA (${formatNumber((data.tipo_iva_detectado ?? 0.21) * 100, 0)}%)`}
                      actual={data.importe_iva ?? null}
                      idx={simIdx.iva}
                      boe={simBoe.iva}
                      web={simWeb.iva}
                    />

                    {/* TOTAL */}
                    <tr className="bg-[#0A0A0A]">
                      <td className="px-4 py-4 text-white font-bold uppercase tracking-wide">TOTAL FACTURA</td>
                      <td className="px-4 py-4 text-right font-bold text-white text-base">{formatCurrency(data.total_factura)}</td>
                      <td className="px-4 py-4 text-right font-bold text-[#00E676] text-base">{formatCurrency(simIdx.total)}</td>
                      <td className="px-4 py-4 text-right font-bold text-blue-400 text-base">{formatCurrency(simBoe.total)}</td>
                      <td className="px-4 py-4 text-right font-bold text-violet-400 text-base">{formatCurrency(simWeb.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Desglose por periodo — indexada */}
            {(data.periodos ?? []).length > 0 && (
              <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-[#1F1F1F]">
                  <h2 className="text-white font-semibold">Precio por periodo — Próxima Cristalina (mercado del periodo facturado)</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-[#1F1F1F]">
                        {['Periodo', 'kWh', 'Precio actual €/kWh', 'del cual mercado', 'Precio indexado'].map((h) => (
                          <th key={h} className="px-4 py-3 text-right first:text-left text-xs text-[#6B7280] uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F1F1F]">
                      {(data.periodos ?? []).map((p) => (
                        <tr key={p.periodo} className="hover:bg-[#1A1A1A]">
                          <td className="px-4 py-3 text-white font-medium">{p.periodo}</td>
                          <td className="px-4 py-3 text-right text-[#9CA3AF]">{formatNumber(p.kwh ?? 0)}</td>
                          <td className="px-4 py-3 text-right text-white">{formatNumber(p.precio_kwh, 4)}</td>
                          <td className="px-4 py-3 text-right text-[#9CA3AF]">{formatNumber(p.mercado_kwh ?? 0, 4)}</td>
                          <td className="px-4 py-3 text-right text-[#00E676] font-medium">{formatNumber(p.precio_kwh_nuevo ?? 0, 4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Honorarios (solo vista interna) */}
            <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6 mb-6">
              <h2 className="text-white font-semibold mb-1">
                Honorarios asesor
                <span className="text-xs text-[#6B7280] font-normal ml-2">(no aparece en PDF del cliente)</span>
              </h2>
              <p className="text-[#6B7280] text-xs mb-5">
                Se suma como cargo por gestión sobre las tres tarifas (indexada y ambas fijas). Es tu comisión, no un margen incluido en el precio publicado.
              </p>
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

// ─── Componente de fila de tabla ──────────────────────────────────────────────
function TableRow({
  label,
  actual,
  idx,
  boe,
  web,
}: {
  label: string
  actual: number | null
  idx: number | null
  boe: number | null
  web: number | null
}) {
  return (
    <tr className="hover:bg-[#1A1A1A]">
      <td className="px-4 py-3 text-[#9CA3AF]">{label}</td>
      <td className="px-4 py-3 text-right text-white">{actual != null ? formatCurrency(actual) : '—'}</td>
      <td className="px-4 py-3 text-right text-[#00E676]">{idx != null ? formatCurrency(idx) : '—'}</td>
      <td className="px-4 py-3 text-right text-blue-400">{boe != null ? formatCurrency(boe) : '—'}</td>
      <td className="px-4 py-3 text-right text-violet-400">{web != null ? formatCurrency(web) : '—'}</td>
    </tr>
  )
}
