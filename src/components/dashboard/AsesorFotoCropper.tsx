'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { Upload, ZoomIn, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/use-toast'

const VIEWPORT = 320
const EXPORT_SIZE = 600

interface ImgState {
  src: string
  naturalWidth: number
  naturalHeight: number
  baseScale: number // scale at zoom=1 so the image just covers the viewport
}

export function AsesorFotoCropper({ currentUrl }: { currentUrl: string }) {
  const { toast } = useToast()
  const [img, setImg] = useState<ImgState | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [savedUrl, setSavedUrl] = useState<string | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; startOffset: { x: number; y: number } } | null>(null)
  const imgElRef = useRef<HTMLImageElement | null>(null)

  const clamp = useCallback((next: { x: number; y: number }, image: ImgState, z: number) => {
    const w = image.naturalWidth * image.baseScale * z
    const h = image.naturalHeight * image.baseScale * z
    const minX = Math.min(0, VIEWPORT - w)
    const minY = Math.min(0, VIEWPORT - h)
    return { x: Math.min(0, Math.max(minX, next.x)), y: Math.min(0, Math.max(minY, next.y)) }
  }, [])

  function handleFile(file: File) {
    const src = URL.createObjectURL(file)
    const el = new Image()
    el.onload = () => {
      const baseScale = Math.max(VIEWPORT / el.naturalWidth, VIEWPORT / el.naturalHeight)
      const w = el.naturalWidth * baseScale
      const h = el.naturalHeight * baseScale
      const centered = { x: (VIEWPORT - w) / 2, y: (VIEWPORT - h) / 2 }
      setImg({ src, naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, baseScale })
      setZoom(1)
      setOffset(centered)
      setSavedUrl(null)
    }
    el.src = src
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!img) return
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOffset: offset }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!img || !dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setOffset(clamp({ x: dragRef.current.startOffset.x + dx, y: dragRef.current.startOffset.y + dy }, img, zoom))
  }

  function onPointerUp() {
    dragRef.current = null
  }

  function onZoomChange(z: number) {
    if (!img) return
    setZoom(z)
    setOffset((prev) => clamp(prev, img, z))
  }

  async function handleSave() {
    if (!img || !imgElRef.current) return
    setSaving(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = EXPORT_SIZE
      canvas.height = EXPORT_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('No se pudo crear el canvas')
      const canvasScale = EXPORT_SIZE / VIEWPORT
      const w = img.naturalWidth * img.baseScale * zoom * canvasScale
      const h = img.naturalHeight * img.baseScale * zoom * canvasScale
      ctx.drawImage(imgElRef.current, offset.x * canvasScale, offset.y * canvasScale, w, h)

      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo exportar la imagen'))), 'image/jpeg', 0.92)
      )

      const form = new FormData()
      form.append('foto', blob, 'jonathan.jpg')
      const res = await fetch('/api/asesor-foto/upload', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al subir la foto')

      setSavedUrl(`${json.url}?v=${Date.now()}`)
      toast({ title: 'Foto actualizada', description: 'Ya se ve en la página del asesor.' })
    } catch (err) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <h2 className="text-white font-semibold mb-3">Foto actual</h2>
        <img
          src={savedUrl ?? currentUrl}
          alt="Foto actual del asesor"
          className="w-44 h-44 rounded-3xl object-cover border-2 border-[#00E676]/30"
        />
        {savedUrl && (
          <p className="flex items-center gap-1.5 text-[#00E676] text-xs mt-3">
            <Check className="w-3.5 h-3.5" /> Guardada — así se ve ahora en /asesor
          </p>
        )}
      </div>

      <div>
        <h2 className="text-white font-semibold mb-3">Ajustar nueva foto</h2>

        {!img && (
          <label className="flex flex-col items-center justify-center gap-2 w-full h-40 rounded-2xl border-2 border-dashed border-[#2A2A2A] text-[#6B7280] hover:border-[#00E676]/40 hover:text-[#9CA3AF] cursor-pointer transition-colors">
            <Upload className="w-6 h-6" />
            <span className="text-sm">Sube una foto</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        )}

        {img && (
          <>
            <div
              className="relative rounded-3xl border-2 border-[#00E676]/30 overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing bg-[#0D0D0D]"
              style={{ width: VIEWPORT, height: VIEWPORT }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              <img
                ref={imgElRef}
                src={img.src}
                alt="Nueva foto (arrastra para mover)"
                draggable={false}
                style={{
                  position: 'absolute',
                  left: offset.x,
                  top: offset.y,
                  width: img.naturalWidth * img.baseScale * zoom,
                  height: img.naturalHeight * img.baseScale * zoom,
                  maxWidth: 'none',
                }}
              />
            </div>

            <div className="flex items-center gap-3 mt-4 max-w-[320px]">
              <ZoomIn className="w-4 h-4 text-[#6B7280] shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => onZoomChange(Number(e.target.value))}
                className="w-full accent-[#00E676]"
              />
            </div>

            <div className="flex gap-3 mt-5">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Guardar foto
              </Button>
              <Button variant="secondary" onClick={() => setImg(null)} disabled={saving}>
                Elegir otra
              </Button>
            </div>
            <p className="text-[#4B5563] text-xs mt-3">Arrastra para mover, usa el control para hacer zoom.</p>
          </>
        )}
      </div>
    </div>
  )
}
