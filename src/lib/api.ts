import { API_URL } from './utils'
import type { InvoiceAnalysis, MarketPrice, NewsItem } from '@/types'

// ─── Invoice ─────────────────────────────────────────────────────────────────

export async function processInvoice(files: File[]): Promise<InvoiceAnalysis> {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  const res = await fetch('/api/process-invoice', { method: 'POST', body: form })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'No se pudo procesar la factura. Asegúrate de subir fotos o PDFs de una factura eléctrica.')
  }
  return res.json()
}

export async function generatePdf(data: InvoiceAnalysis, feeEnergia: number, feePotencia: number): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/generate-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, fee_energia: feeEnergia, fee_potencia: feePotencia }),
  })
  if (!res.ok) throw new Error('Error al generar el PDF')
  return res.blob()
}

export async function sendReport(params: {
  nombre: string
  email: string
  telefono?: string
  empresa?: string
  invoice_data: InvoiceAnalysis
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/send-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('Error al enviar el informe')
  return res.json()
}

// ─── Market ──────────────────────────────────────────────────────────────────
// Uses Next.js API route — works without the Python backend running

export async function getMarketPrices(): Promise<MarketPrice[]> {
  const base = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')
  const res = await fetch(`${base}/api/market-prices`, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error('Error al obtener precios de mercado')
  return res.json()
}

// ─── News ─────────────────────────────────────────────────────────────────────
// Uses Next.js API route — works// without the Python backend running

export async function getNews(): Promise<{ noticias: NewsItem[] }> {
  const base = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')
  const res = await fetch(`${base}/api/news`, { next: { revalidate: 600 } })
  if (!res.ok) throw new Error('Error al obtener noticias')
  return res.json()
}
