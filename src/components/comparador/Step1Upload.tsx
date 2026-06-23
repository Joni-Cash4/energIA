'use client'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, Loader2, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { processInvoice } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { InvoiceAnalysis } from '@/types'

interface Props {
  onComplete: (data: InvoiceAnalysis) => void
}

const LOADING_MESSAGES = [
  'Leyendo tu factura...',
  'Extrayendo consumos por periodo...',
  'Calculando ahorro potencial...',
  'Comparando tarifas de mercado...',
  'Preparando tu informe...',
]

export function Step1Upload({ onComplete }: Props) {
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  const onDrop = useCallback((dropped: File[]) => {
    setPendingFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size))
      return [...prev, ...dropped.filter((f) => !existing.has(f.name + f.size))]
    })
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (pendingFiles.length === 0) return
    setError(null)
    setLoading(true)

    const interval = setInterval(() => {
      setLoadingMsg((p) => (p + 1) % LOADING_MESSAGES.length)
    }, 1200)

    try {
      const data = await processInvoice(pendingFiles)
      clearInterval(interval)
      onComplete(data)
    } catch (err) {
      clearInterval(interval)
      setError(err instanceof Error ? err.message : 'No se pudo procesar la factura. Asegúrate de subir fotos o PDFs de una factura eléctrica.')
      setLoading(false)
    }
  }, [pendingFiles, onComplete])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    disabled: loading,
  })

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="text-2xl font-bold text-white mb-2 text-center">Sube tu factura eléctrica</h2>
        <p className="text-[#9CA3AF] text-center mb-8">
          PDF, fotos JPG/PNG — puedes subir varias páginas a la vez
        </p>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={cn(
            'relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300',
            isDragActive
              ? 'border-[#00E676] bg-[#00E676]/5 scale-[1.01]'
              : 'border-[#2A2A2A] bg-[#141414] hover:border-[#00E676]/50 hover:bg-[#00E676]/3',
            loading && 'cursor-not-allowed opacity-70'
          )}
        >
          <input {...getInputProps()} />
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full border-2 border-[#00E676]/30 border-t-[#00E676] animate-spin" />
                <p className="text-[#00E676] font-medium text-lg">{LOADING_MESSAGES[loadingMsg]}</p>
                <p className="text-[#6B7280] text-sm">Esto tarda unos segundos...</p>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
                <div className={cn('w-20 h-20 rounded-2xl border-2 flex items-center justify-center transition-colors duration-300', isDragActive ? 'border-[#00E676] bg-[#00E676]/10' : 'border-[#2A2A2A]')}>
                  <Upload className={cn('w-10 h-10 transition-colors', isDragActive ? 'text-[#00E676]' : 'text-[#6B7280]')} />
                </div>
                <div>
                  <p className="text-white text-lg font-medium mb-1">
                    {isDragActive ? 'Suelta los archivos aquí' : 'Arrastra aquí la factura'}
                  </p>
                  <p className="text-[#6B7280] text-sm">PDF o fotos · Puedes añadir varias páginas</p>
                </div>
                <Button variant="secondary" size="sm" className="mt-2">Seleccionar archivos</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* File list */}
        {pendingFiles.length > 0 && !loading && (
          <div className="mt-3 bg-[#141414] border border-[#1F1F1F] rounded-xl overflow-hidden">
            {pendingFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[#1F1F1F] last:border-0">
                <FileText className="w-4 h-4 text-[#6B7280] shrink-0" />
                <span className="text-sm text-white flex-1 truncate">{f.name}</span>
                <span className="text-xs text-[#6B7280] shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                <button onClick={(e) => { e.stopPropagation(); setPendingFiles((p) => p.filter((_, j) => j !== i)) }} className="text-[#6B7280] hover:text-red-400 transition-colors ml-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Analyze button */}
        {pendingFiles.length > 0 && !loading && (
          <Button onClick={handleAnalyze} className="w-full mt-4 gap-2 glow-green">
            <FileText className="w-4 h-4" />
            Analizar {pendingFiles.length} {pendingFiles.length === 1 ? 'archivo' : 'archivos'} con IA
          </Button>
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-[#6B7280] text-xs mt-6">
          Tu factura no se almacena permanentemente. Solo se usa para el análisis.
        </p>
      </motion.div>
    </div>
  )
}
