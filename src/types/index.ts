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
  fee_incluido?: boolean  // true = el precio del producto YA lleva la comisión — no sumarle el fee del deslizador
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
  excesos_potencia_total?: number
  alquiler_equipos?: number
  total_nuevo_estimado?: number
  importe_iee?: number
  base_imponible?: number
  importe_iva?: number
  tipo_iee_detectado?: number
  tipo_iva_detectado?: number
  mercado_historico_ok?: boolean
  mercado_real_fuente?: 'supabase' | 'hardcoded' | 'fallback'
  // PMD OMIE real por periodo (€/MWh) — base de las formulas indexadas
  pmd_periodos?: Partial<Record<string, number>>
  potencias_desglosadas?: boolean
  atulado_recomendado?: 'BOE' | 'WEB'
  // v2.0 — simulaciones reales (PERD×(PMD+SC+CAP), BOE 2026, fijas del maestro)
  // sim_fija_boe/web son slots históricos: 1ª y 2ª mejor fija del ranking.
  // El nombre real del producto va en SimTarifa.nota.
  sim_indexada?: SimTarifa
  sim_fija_boe?: SimTarifa
  sim_fija_web?: SimTarifa
  ranking_fijas?: { nombre: string; total: number }[]
  // Todas las simulaciones fijas (sin fee): el dashboard aplica el fee solo a
  // las que no lo llevan integrado y re-ordena con el valor real del deslizador.
  sim_fijas?: SimTarifa[]
  fijas_fuente?: 'supabase' | 'fallback'
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
  factura_urls?: string[]
  created_at: string
  estado: LeadEstado
}

export interface Cliente {
  id: string
  nombre: string
  cups?: string
  cups_id?: string  // referencia a cups (ADR-0001) — cups sigue siendo el texto libre histórico
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
  // kwh_anuales: tamaño de cartera (kWh bajo gestión). kw_contratados: potencia
  // contratada, usada para comparar contra la demanda real medida (Datadis) —
  // ninguno de los dos es un dato de comisión (eso vive en Contrato, ver
  // ADR-0003 y lib/comisiones.ts).
  kwh_anuales?: number
  kw_contratados?: number
  proximo_contacto?: string
  fecha_inicio_contrato?: string
  // Datadis
  autorizacion_datadis?: string
  ultima_sync_datadis?: string
  created_at: string
  updated_at: string
  facturas?: Factura[]
}

export interface ConsumoDatadis {
  id: string
  cliente_id: string
  cups: string
  year_month: string   // YYYY-MM
  kwh_total: number
  fecha_consulta: string
}

export interface PotenciaDatadis {
  id: string
  cliente_id: string
  cups: string
  year_month: string       // YYYY-MM del ciclo de lectura
  periodo: string          // '1'..'6' (P1..P6 Datadis)
  potencia_max_kw: number
  fecha_pico?: string
  hora_pico?: string
  fecha_consulta: string
}

export interface Factura {
  id: string
  cliente_id: string
  // Periodo facturado
  fecha_inicio?: string
  fecha_fin?: string
  fecha_factura?: string
  dias_facturados?: number
  // Suministro
  cups?: string
  comercializadora?: string
  tarifa?: string
  potencia_contratada?: number
  // Importes
  total_factura?: number
  kwh_total?: number
  precio_medio_kwh?: number
  // Ahorro estimado vs indexada
  ahorro_estimado_anual?: number
  ahorro_estimado_mensual?: number
  porcentaje_ahorro?: number
  // Contexto anterior (para comparación futura)
  comercializadora_anterior?: string
  tarifa_anterior?: string
  // Fee asesor y adjuntos
  fee_aplicado?: number
  pdf_url?: string
  excel_url?: string
  created_at: string
}

export type ContratoEstado  = 'activo' | 'baja' | 'pendiente'

export type EstadoFirma = 'pendiente_firma' | 'firmado' | 'rechazado'

// Motivo real de baja (ADR-0002) — solo tiene sentido cuando estado === 'baja'.
export type ContratoMotivoBaja = 'cambio_gestor' | 'cambio_comercializadora' | 'cierre_negocio' | 'cups_baja'

// Punto de suministro como entidad de referencia (ADR-0001). No cambia
// aunque cambie el titular — por eso vive aparte de Cliente/Contrato.
export interface Cups {
  id: string
  codigo: string
  direccion?: string
  cp?: string
  poblacion?: string
  provincia?: string
  tarifa_acceso?: string
  notas?: string
  created_at: string
}

export interface Contrato {
  id: string
  user_id: string
  cliente_id?: string
  cups?: string
  cups_id?: string  // referencia a cups (ADR-0001) — cups sigue siendo el texto libre histórico
  comercializadora?: string
  tarifa?: string
  producto?: string
  fecha_firma?: string
  fecha_alta?: string
  fecha_vencimiento?: string
  duracion_meses?: number
  estado: ContratoEstado
  estado_firma: EstadoFirma
  motivo_baja?: ContratoMotivoBaja
  ref_comercializadora?: string
  renovacion_verificada: boolean
  a_cobrar?: number
  // Seguimiento de comisión (ver /dashboard/comisiones, lib/comisiones.ts y
  // ADR-0003): kWh anuales que la comercializadora reportó al calcular la
  // comisión inicial, fee €/MWh pactado, y reparto (1.00=Próxima,
  // 0.95=Atulado). Potencia es la misma idea pero en kW — casi nunca se
  // pacta, pero la opción existe (calcularComisionContrato la suma si está).
  kwh_base_comision?: number
  fee_energia_mwh?: number
  kw_base_comision?: number
  fee_potencia_mwh?: number
  reparto_energia?: number
  // Evidencia de la comisión pactada (ADR-0003): foto/captura que manda la
  // comercializadora, de la que se extraen fee_energia_mwh/fee_potencia_mwh
  // por IA (api/comision-foto/upload). Solo evidencia — no se edita a mano.
  comision_foto_url?: string
  notas?: string
  created_at: string
  updated_at: string
  cliente?: Pick<Cliente, 'id' | 'nombre' | 'empresa'>
}

export interface EmpresaPago {
  id: string
  user_id: string
  nombre: string
  nif: string
  direccion?: string
  cp?: string
  poblacion?: string
  provincia?: string
  retencion_pct: number
  comercializadoras_keywords: string[]
  es_default: boolean
  activo: boolean
  created_at: string
}

export type ComisionTipo = 'alta' | 'renovacion' | 'correccion'

export interface ComisionGenerada {
  id: string
  user_id: string
  contrato_id?: string
  cliente_id?: string
  cups?: string
  comercializadora?: string
  empresa_pago_id: string
  tipo: ComisionTipo
  importe: number
  fecha: string
  facturado: boolean
  numero_factura?: string
  notas?: string
  created_at: string
  empresa_pago?: Pick<EmpresaPago, 'id' | 'nombre' | 'nif' | 'retencion_pct'>
  cliente?: Pick<Cliente, 'id' | 'nombre' | 'empresa'>
}

// Calendario de cobros: Próxima fracciona el pago de una comisión según su
// importe (>1.000€ → 3 pagos, >10.000€ → 6, resto único), cada uno con
// vencimiento el último día de su mes. Una fila por cuota. Ver lib/cobros.ts.
export interface ComisionCobro {
  id: string
  user_id: string
  comision_id: string
  num_pago: number
  total_pagos: number
  importe: number
  fecha_prevista: string
  cobrado: boolean
  fecha_cobro?: string
  prefactura_num?: string
  notas?: string
  created_at: string
  comision?: {
    id: string
    cups?: string
    comercializadora?: string
    importe: number
    tipo: ComisionTipo
    cliente?: Pick<Cliente, 'id' | 'nombre' | 'empresa'> | null
  } | null
}

export type AccionTipoVal     = 'llamada' | 'email' | 'reunion' | 'visita' | 'otro'
export type AccionResultadoVal = 'pendiente' | 'completado' | 'fracaso' | 'no_contesta'

export interface Accion {
  id: string
  user_id: string
  cliente_id?: string
  fecha: string
  hora?: string
  tipo: AccionTipoVal
  resultado: AccionResultadoVal
  notas?: string
  created_at: string
}

export type GestionTipoVal   = 'solicitamos' | 'nos_solicitan'
export type GestionEstadoVal = 'pendiente' | 'en_curso' | 'resuelto'
export type GestionViaVal    = 'email' | 'telefono' | 'portal' | 'carta' | 'otro'
export type GestionOrigenVal = 'manual' | 'audio' | 'texto' | 'validador'

export interface Gestion {
  id: string
  user_id: string
  cliente_id?: string
  contrato_id?: string       // opcional (ADR-0004) — solo cuando cliente y contrato son conocidos
  titular?: string           // fallback si la gestión no está ligada a un cliente del CRM
  cups?: string
  compania: string
  tipo: GestionTipoVal
  asunto: string
  via: GestionViaVal
  fecha_alta: string
  proximo_seguimiento?: string
  estado: GestionEstadoVal
  resolucion?: string
  fecha_resolucion?: string
  notas?: string
  origen: GestionOrigenVal
  transcripcion?: string
  revisar_cliente: boolean
  created_at: string
  updated_at: string
  cliente?: Pick<Cliente, 'id' | 'nombre' | 'empresa'>
  contrato?: Pick<Contrato, 'id' | 'cups' | 'comercializadora'>
}

export interface GestionEvento {
  id: string
  gestion_id: string
  user_id: string
  fecha: string
  nota: string
  created_at: string
}

export type ClienteAdjuntoTipo = 'imagen' | 'pdf' | 'otro'

export interface ClienteAdjunto {
  id: string
  user_id: string
  cliente_id: string
  contrato_id?: string
  nombre?: string
  tipo: ClienteAdjuntoTipo
  url: string
  storage_path: string
  notas?: string
  created_at: string
}

// ─── Validador de facturas ─────────────────────────────────────────────────────

// Fórmula de una tarifa indexada: precio_kWh = OMIE_periodo × Di + CMFi + ATRe.
// Los coeficientes se congelan al firmar, por eso el catálogo se busca por la
// ventana de firma del anexo y no por la fecha de la factura.
export interface FormulaIndexada {
  id: string
  etiqueta: string
  match_comercializadora: string
  match_producto: string
  tarifa_acceso: string
  firma_desde: string
  firma_hasta: string
  di: Partial<Record<string, number>>
  cmfi: Partial<Record<string, number>>   // €/kWh
  // CO / margen del agente que la comercializadora suma al precio de energía.
  // Va aparte de Di y CMFi porque se negocia por contrato: este es el valor por
  // defecto del producto, y contratos.fee_energia_mwh lo pisa si está relleno
  // (ADR-0003: columna única de comisión, consolidada 2026-07-26).
  co_eur_mwh: number
  activo: boolean
  notas?: string
}

export type EstadoConcepto = 'ok' | 'error' | 'revisar' | 'no_verificable' | 'info'

export interface ConceptoValidacion {
  concepto: string
  esperado: number | null
  real: number | null
  diferencia_eur: number | null
  estado: EstadoConcepto
  detalle?: string
}

export interface ValidacionFactura {
  conceptos: ConceptoValidacion[]
  desviacion_total_eur: number
  tiene_errores: boolean
}

export interface FacturaValidacion {
  id: string
  user_id: string
  cliente_id?: string
  cups?: string
  fecha_factura?: string
  desviacion_total_eur: number
  detalle: ConceptoValidacion[]
  gestion_id?: string
  created_at: string
}

export interface FacturaContrato {
  id: string
  cliente_id: string
  contrato_id?: string  // referencia al contrato concreto (ADR-0001, Fase 2)
  cups: string
  comercializadora: string
  numero_factura?: string
  fecha_factura?: string
  periodo_inicio?: string
  periodo_fin?: string
  kwh_total?: number
  importe_total?: number
  importe_base?: number
  precio_kwh_efectivo?: number
  ahorro_vs_anterior?: number
  pdf_url?: string
  datos_extraidos?: Record<string, unknown>
  notas?: string
  created_at: string
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

export type ComparadorStep = 1 | 2 | 3
