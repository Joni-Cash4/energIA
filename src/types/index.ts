// ─── API Response Types ───────────────────────────────────────────────────────

export interface PeriodData {
  periodo: string
  kwh: number
  precio_kwh: number
  importe: number
  mercado_kwh?: number
  // Simulación indexada (Próxima-style)
  kwh_nuevo?: number
  precio_kwh_nuevo?: number
  importe_nuevo?: number
}

// Potencia contratada por periodo tarifario — NO siempre es uniforme.
// 3.0TD/6.1TD tienen 6 periodos de potencia aunque solo 1-3 tengan consumo de energía.
export interface PotenciaPeriodo {
  periodo: string
  kw: number
}

export interface SimTarifa {
  energia: number
  potencia: number
  potencia_periodos?: Partial<Record<string, number>>  // €/periodo — para desglose P1-P6
  reactiva: number
  otros_costes: number
  cargo_gestion: number
  subtotal: number
  iee: number
  alquiler: number
  base_iva: number
  iva: number
  iva_pct: number
  total: number
  nota?: string  // aviso si algún dato es aproximado
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
  dias_facturados: number
  ahorro_estimado_anual: number
  ahorro_estimado_mensual: number
  porcentaje_ahorro: number
  kwh_anuales_sips: number
  periodos: PeriodData[]
  potencias?: PotenciaPeriodo[]  // kW contratados por periodo — puede no ser uniforme
  coste_actual_energia: number
  coste_nuevo_energia: number
  coste_actual_potencia: number
  coste_nuevo_potencia: number
  mercado_actual_mwh?: number
  potencia_total?: number
  reactiva_total?: number
  alquiler_equipos?: number
  productos_total?: number
  total_nuevo_estimado?: number
  importe_iee?: number
  base_imponible?: number
  importe_iva?: number
  tipo_iee_detectado?: number
  tipo_iva_detectado?: number
  mercado_historico_ok?: boolean
  mercado_real_fuente?: 'supabase' | 'hardcoded' | 'fallback'
  potencias_desglosadas?: boolean
  atulado_recomendado?: 'BOE' | 'WEB'
  // v2.0 — simulaciones reales (PERD×(PMD+SC+CAP), BOE 2026, Atulado BOE/WEB)
  sim_indexada?: SimTarifa
  sim_fija_boe?: SimTarifa
  sim_fija_web?: SimTarifa
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
  _zona?: string
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
  movil?: string
  empresa?: string
  nif?: string
  direccion?: string
  cp?: string
  poblacion?: string
  provincia?: string
  estado: ClienteEstado
  notas?: string
  revision_pendiente?: boolean
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

export type ContratoEstado  = 'activo' | 'baja' | 'pendiente'
export type AccionTipo      = 'llamada' | 'email' | 'reunion' | 'visita' | 'otro'
export type AccionResultado = 'pendiente' | 'completado' | 'fracaso' | 'no_contesta'

export interface Contrato {
  id: string
  user_id: string
  cliente_id?: string
  cups?: string
  comercializadora?: string
  tarifa?: string
  producto?: string
  fecha_firma?: string
  fecha_alta?: string
  fecha_vencimiento?: string
  duracion_meses?: number
  estado: ContratoEstado
  renovacion_verificada: boolean
  a_cobrar?: number
  notas?: string
  created_at: string
  updated_at: string
  cliente?: Pick<Cliente, 'id' | 'nombre' | 'empresa'>
}

export interface Accion {
  id: string
  user_id: string
  cliente_id?: string
  fecha: string
  hora?: string
  tipo: AccionTipo
  resultado: AccionResultado
  notas?: string
  created_at: string
  cliente?: Pick<Cliente, 'id' | 'nombre' | 'empresa'>
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

export type ComparadorStep = 1 | 2 | 3
