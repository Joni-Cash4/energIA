// ─── API Response Types ───────────────────────────────────────────────────────

export interface PeriodData {
  periodo: string
  kwh: number
  precio_kwh: number
  importe: number
  kwh_nuevo?: number
  precio_kwh_nuevo?: number
  importe_nuevo?: number
}

export interface InvoiceAnalysis {
  cups: string
  comercializadora: string
  tarifa: string
  fecha_inicio: string
  fecha_fin: string
  total_factura: number
  kwh_total: number
  potencia_contratada: number
  ahorro_estimado_anual: number
  ahorro_estimado_mensual: number
  porcentaje_ahorro: number
  kwh_anuales_sips: number
  periodos: PeriodData[]
  coste_actual_energia: number
  coste_nuevo_energia: number
  coste_actual_potencia: number
  coste_nuevo_potencia: number
}

export interface MarketPrice {
  periodo: string
  precio_mwh: number
  precio_kwh: number
  variacion: number
}

export interface HourlyPrice {
  hora: number           // 0–23
  precio_mwh: number
  es_barata: boolean
  es_cara: boolean
}

export interface MarketHourlyResponse {
  precios: HourlyPrice[]
  ahora: number
  precio_ahora: number
  minimo: number
  maximo: number
  media: number
  hora_min: number
  hora_max: number
  _source?: string
  _date?: string
  _values_count?: number
  _error?: string
}

export interface NewsItem {
  id: string
  titulo: string
  descripcion: string
  url: string
  imagen?: string
  fuente: string
  fecha: string
}

export interface Contacto {
  id: string
  nombre: string
  email: string
  telefono?: string
  mensaje: string
  created_at: string
  leido: boolean
}

// ─── Supabase Table Types ─────────────────────────────────────────────────────

export type LeadEstado = 'nuevo' | 'contactado' | 'convertido' | 'descartado'
export type ClienteEstado = 'prospecto' | 'reunion' | 'oferta' | 'firmado' | 'perdido'

export interface Lead {
  id: string
  nombre: string
  email: string
  telefono?: string
  empresa?: string
  cups?: string
  comercializadora?: string
  tarifa?: string
  total_factura?: number
  kwh_total?: number
  ahorro_estimado_anual?: number
  kwh_anuales_sips?: number
  created_at: string
  estado: LeadEstado
}

export interface Cliente {
  id: string
  nombre: string
  cups?: string
  comercializadora?: string
  tarifa?: string
  email?: string
  telefono?: string
  empresa?: string
  estado: ClienteEstado
  notas?: string
  // cartera fields
  fee_energia?: number
  fee_potencia?: number
  kwh_anuales?: number
  kw_contratados?: number
  proximo_contacto?: string
  fecha_inicio_contrato?: string
  created_at: string
  updated_at: string
  facturas?: Factura[]
}

export interface Factura {
  id: string
  cliente_id: string
  fecha_inicio?: string
  fecha_fin?: string
  total_factura?: number
  kwh_total?: number
  ahorro_estimado_anual?: number
  fee_aplicado?: number
  pdf_url?: string
  excel_url?: string
  created_at: string
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

export type ComparadorStep = 1 | 2 | 3
