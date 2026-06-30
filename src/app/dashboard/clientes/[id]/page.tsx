'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, Save, Loader2, Plus, FileCheck, Clock, CheckCircle2, Phone, Mail, Users, MapPin, MessageSquare, Send, RefreshCw, Zap, Upload, FileText } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getSupabaseClient } from '@/lib/supabase'
import { formatDate, formatCurrency } from '@/lib/utils'
import { useToast } from '@/lib/use-toast'
import type { Cliente, Factura, Contrato, ClienteEstado, Accion, AccionTipoVal, AccionResultadoVal, ConsumoDatadis, FacturaContrato } from '@/types'

const TIPO_ICONS: Record<AccionTipoVal, typeof Phone> = {
  llamada: Phone, email: Mail, reunion: Users, visita: MapPin, otro: MessageSquare,
}
const TIPO_LABELS: Record<AccionTipoVal, string> = {
  llamada: 'Llamada', email: 'Email', reunion: 'Reunión', visita: 'Visita', otro: 'Otro',
}
const RESULTADO_LABELS: Record<AccionResultadoVal, string> = {
  pendiente: 'Pendiente', completado: 'Completado', fracaso: 'No interesado', no_contesta: 'No contesta',
}
const RESULTADO_COLOR: Record<AccionResultadoVal, string> = {
  pendiente: 'text-yellow-400', completado: 'text-[#00E676]', fracaso: 'text-red-400', no_contesta: 'text-[#6B7280]',
}

function diasRestantes(fecha: string) {
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
}

function mesesRestantes(fecha: string) {
  const d = new Date(fecha)
  const now = new Date()
  return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth())
}

const ESTADOS: { value: ClienteEstado; label: string }[] = [
  { value: 'prospecto', label: 'Prospecto' },
  { value: 'reunion',   label: 'Reunión' },
  { value: 'oferta',    label: 'Oferta' },
  { value: 'firmado',   label: 'Firmado' },
  { value: 'perdido',   label: 'Perdido' },
]

const ESTADO_VARIANT: Record<ClienteEstado, 'default' | 'blue' | 'yellow' | 'red' | 'secondary' | 'purple'> = {
  prospecto: 'secondary', reunion: 'blue', oferta: 'yellow', firmado: 'default', perdido: 'red',
}

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [acciones, setAcciones] = useState<Accion[]>([])
  const [accionTipo, setAccionTipo] = useState<AccionTipoVal>('llamada')
  const [accionResultado, setAccionResultado] = useState<AccionResultadoVal>('completado')
  const [accionNotas, setAccionNotas] = useState('')
  const [savingAccion, setSavingAccion] = useState(false)
  const [autorizacionDatadis, setAutorizacionDatadis] = useState('')
  const [consumosDatadis, setConsumosDatadis] = useState<ConsumoDatadis[]>([])
  const [syncingDatadis, setSyncingDatadis] = useState(false)
  const [ultimaSyncDatadis, setUltimaSyncDatadis] = useState<string | null>(null)
  const [facturasContrato, setFacturasContrato] = useState<FacturaContrato[]>([])
  const [uploadingFactura, setUploadingFactura] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Contact fields
  const [nombre,    setNombre]    = useState('')
  const [empresa,   setEmpresa]   = useState('')
  const [nif,       setNif]       = useState('')
  const [email,     setEmail]     = useState('')
  const [telefono,  setTelefono]  = useState('')
  const [movil,     setMovil]     = useState('')
  const [cups,      setCups]      = useState('')
  const [comercializadora, setComercializadora] = useState('')
  const [direccion, setDireccion] = useState('')
  const [cp,        setCp]        = useState('')
  const [poblacion, setPoblacion] = useState('')
  const [provincia, setProvincia] = useState('')

  // Management fields
  const [estado,               setEstado]               = useState<ClienteEstado>('prospecto')
  const [notas,                setNotas]                = useState('')
  const [feeEnergia,           setFeeEnergia]           = useState('')
  const [feePotencia,          setFeePotencia]          = useState('')
  const [kwhAnuales,           setKwhAnuales]           = useState('')
  const [kwContratados,        setKwContratados]        = useState('')
  const [proximoContacto,      setProximoContacto]      = useState('')
  const [fechaInicioContrato,  setFechaInicioContrato]  = useState('')

  useEffect(() => {
    const supabase = getSupabaseClient()
    Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase.from('facturas').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
      supabase.from('contratos').select('*').eq('cliente_id', id).order('fecha_vencimiento', { ascending: true }),
      supabase.from('acciones').select('*').eq('cliente_id', id).order('fecha', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('consumos_datadis').select('*').eq('cliente_id', id).order('year_month', { ascending: false }),
      supabase.from('facturas_contrato').select('*').eq('cliente_id', id).order('periodo_fin', { ascending: false }),
    ]).then(([{ data: c }, { data: f }, { data: ct }, { data: ac }, { data: cd }, { data: fc }]) => {
      if (!c) { router.replace('/dashboard/clientes'); return }
      setCliente(c)
      setNombre(c.nombre ?? '')
      setEmpresa(c.empresa ?? '')
      setNif(c.nif ?? '')
      setEmail(c.email ?? '')
      setTelefono(c.telefono ?? '')
      setMovil(c.movil ?? '')
      setCups(c.cups ?? '')
      setComercializadora(c.comercializadora ?? '')
      setDireccion(c.direccion ?? '')
      setCp(c.cp ?? '')
      setPoblacion(c.poblacion ?? '')
      setProvincia(c.provincia ?? '')
      setEstado(c.estado)
      setNotas(c.notas ?? '')
      setFeeEnergia(String(c.fee_energia ?? ''))
      setFeePotencia(String(c.fee_potencia ?? ''))
      setKwhAnuales(String(c.kwh_anuales ?? ''))
      setKwContratados(String(c.kw_contratados ?? ''))
      setProximoContacto(c.proximo_contacto ?? '')
      setFechaInicioContrato(c.fecha_inicio_contrato ?? '')
      setAutorizacionDatadis(c.autorizacion_datadis ?? '')
      setUltimaSyncDatadis(c.ultima_sync_datadis ?? null)
      setFacturas(f ?? [])
      setContratos((ct ?? []) as Contrato[])
      setAcciones((ac ?? []) as Accion[])
      setConsumosDatadis((cd ?? []) as ConsumoDatadis[])
      setFacturasContrato((fc ?? []) as FacturaContrato[])
      setLoading(false)
    })
  }, [id, router])

  const handleDismissRevision = async () => {
    setDismissing(true)
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('clientes').update({ revision_pendiente: false }).eq('id', id)
    if (error) toast({ title: 'Error', variant: 'destructive' })
    else { setCliente((p) => p ? { ...p, revision_pendiente: false } : p); toast({ title: 'Marcado como atendido' }) }
    setDismissing(false)
  }

  const handleSaveAccion = async () => {
    setSavingAccion(true)
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: nueva, error } = await supabase.from('acciones').insert({
      user_id:   user!.id,
      cliente_id: id,
      fecha:     new Date().toISOString().split('T')[0],
      tipo:      accionTipo,
      resultado: accionResultado,
      notas:     accionNotas || null,
    }).select().single()
    if (error) {
      toast({ title: 'Error al guardar acción', variant: 'destructive' })
    } else {
      setAcciones(p => [nueva as Accion, ...p])
      setAccionNotas('')
      toast({ title: 'Acción registrada' })
    }
    setSavingAccion(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('clientes').update({
      nombre,
      empresa:               empresa || null,
      nif:                   nif || null,
      email:                 email || null,
      telefono:              telefono || null,
      movil:                 movil || null,
      cups:                  cups || null,
      comercializadora:      comercializadora || null,
      direccion:             direccion || null,
      cp:                    cp || null,
      poblacion:             poblacion || null,
      provincia:             provincia || null,
      estado,
      notas,
      fee_energia:           feeEnergia ? Number(feeEnergia) : null,
      fee_potencia:          feePotencia ? Number(feePotencia) : null,
      kwh_anuales:           kwhAnuales ? Number(kwhAnuales) : null,
      kw_contratados:        kwContratados ? Number(kwContratados) : null,
      proximo_contacto:       proximoContacto || null,
      fecha_inicio_contrato:  fechaInicioContrato || null,
      autorizacion_datadis:   autorizacionDatadis || null,
    }).eq('id', id)

    if (error) toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' })
    else {
      toast({ title: 'Cambios guardados' })
      setCliente((p) => p ? { ...p, nombre, empresa: empresa || undefined, estado, notas, email: email || undefined, telefono: telefono || undefined } : p)
    }
    setSaving(false)
  }

  const handleUploadFactura = async (file: File) => {
    setUploadingFactura(true)
    try {
      const form = new FormData()
      form.append('pdf', file)
      form.append('clienteId', id)
      const res = await fetch('/api/facturas-contrato/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido')
      setFacturasContrato(prev => [data.factura as FacturaContrato, ...prev])
      toast({ title: 'Factura procesada', description: `Nº ${data.factura.numero_factura ?? '—'}` })
    } catch (err) {
      toast({ title: 'Error al subir factura', description: String(err), variant: 'destructive' })
    }
    setUploadingFactura(false)
  }

  const handleSyncDatadis = async () => {
    if (!cliente?.cups) {
      toast({ title: 'Falta CUPS', description: 'Rellena el CUPS antes de sincronizar', variant: 'destructive' })
      return
    }
    setSyncingDatadis(true)
    try {
      const res = await fetch('/api/datadis/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: id, nif: cliente.nif, cups: cliente.cups }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido')

      // Escribir consumos en Supabase con la sesión del cliente
      const supabase = getSupabaseClient()
      if (data.consumos?.length > 0) {
        await supabase
          .from('consumos_datadis')
          .upsert(data.consumos, { onConflict: 'cliente_id,cups,year_month' })
      }

      const ahora = new Date().toISOString()
      await supabase.from('clientes').update({ ultima_sync_datadis: ahora }).eq('id', id)
      setUltimaSyncDatadis(ahora)

      const { data: cd } = await supabase
        .from('consumos_datadis').select('*').eq('cliente_id', id).order('year_month', { ascending: false })
      setConsumosDatadis((cd ?? []) as ConsumoDatadis[])
      toast({ title: `Sincronizado: ${data.meses_sincronizados} meses`, description: `${Math.round(data.kwh_total).toLocaleString('es-ES')} kWh totales` })
    } catch (err) {
      toast({ title: 'Error Datadis', description: String(err), variant: 'destructive' })
    }
    setSyncingDatadis(false)
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-7 h-7 rounded-full border-2 border-[#00E676]/30 border-t-[#00E676] animate-spin" />
    </div>
  )
  if (!cliente) return null

  // Próximo vencimiento de contrato activo
  const contratoActivo = contratos
    .filter(ct => ct.estado === 'activo' && ct.fecha_vencimiento)
    .sort((a, b) => new Date(a.fecha_vencimiento!).getTime() - new Date(b.fecha_vencimiento!).getTime())
    .at(0)

  const mesesVenc = contratoActivo?.fecha_vencimiento ? mesesRestantes(contratoActivo.fecha_vencimiento) : null

  return (
    <div>
      <Link href="/dashboard/clientes" className="inline-flex items-center gap-2 text-[#6B7280] hover:text-white transition-colors text-sm mb-6">
        <ArrowLeft className="w-4 h-4" />Volver a clientes
      </Link>

      {cliente.revision_pendiente && (
        <div className="mb-6 flex items-center justify-between gap-4 p-4 rounded-xl bg-amber-400/5 border border-amber-400/20">
          <div className="flex items-center gap-3 text-amber-300 text-sm">
            <Clock className="w-4 h-4 shrink-0" />
            <div>
              <p className="font-medium">Pendiente de revisión</p>
              <p className="text-amber-300/60 text-xs mt-0.5">Sin contrato registrado o con contrato vencido hace más de 1 año. Registra el contrato actual y marca como atendido.</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5 shrink-0 border-amber-400/30 text-amber-300 hover:bg-amber-400/10"
            onClick={handleDismissRevision}
            disabled={dismissing}
          >
            {dismissing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Marcar atendido
          </Button>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex-1 space-y-6">
          {/* Header card */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h1 className="text-2xl font-bold text-white">{cliente.nombre}</h1>
                {cliente.empresa && <p className="text-[#9CA3AF] mt-1">{cliente.empresa}</p>}
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Badge variant={ESTADO_VARIANT[cliente.estado]}>{ESTADOS.find(e => e.value === cliente.estado)?.label}</Badge>
                {mesesVenc !== null && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                    mesesVenc <= 1 ? 'text-red-400 border-red-400/30 bg-red-400/5' :
                    mesesVenc <= 3 ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5' :
                    'text-[#00E676] border-[#00E676]/30 bg-[#00E676]/5'
                  }`}>
                    Renueva en {mesesVenc <= 0 ? 'menos de 1 mes' : `${mesesVenc} ${mesesVenc === 1 ? 'mes' : 'meses'}`}
                  </span>
                )}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              {[
                { label: 'NIF / DNI',        value: cliente.nif },
                { label: 'Email',            value: cliente.email },
                { label: 'Teléfono',         value: cliente.telefono },
                { label: 'Móvil',            value: cliente.movil },
                { label: 'CUPS',             value: cliente.cups, mono: true },
                { label: 'Comercializadora', value: cliente.comercializadora },
                { label: 'Dirección',        value: cliente.direccion },
                { label: 'CP / Localidad',   value: [cliente.cp, cliente.poblacion].filter(Boolean).join(' ') },
                { label: 'Provincia',        value: cliente.provincia },
                { label: 'Alta',             value: formatDate(cliente.created_at) },
              ].filter(({ value }) => value).map(({ label, value, mono }) => (
                <div key={label}>
                  <p className="text-[#6B7280] text-xs mb-0.5">{label}</p>
                  <p className={`text-white ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contratos */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1F1F1F] flex items-center justify-between">
              <h2 className="text-white font-semibold">Contratos</h2>
              <Link href={`/dashboard/contratos?cliente_id=${id}`}>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" />Añadir
                </Button>
              </Link>
            </div>
            {contratos.length === 0 ? (
              <div className="py-10 text-center text-[#6B7280] text-sm">No hay contratos registrados.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1F1F1F]">
                      {['Alta', 'Vencimiento', 'Duración', 'Renueva en', 'Comercializadora', 'Producto', 'Renovación'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contratos.map((ct) => {
                      const dias = ct.fecha_vencimiento ? diasRestantes(ct.fecha_vencimiento) : null
                      const meses = ct.fecha_vencimiento ? mesesRestantes(ct.fecha_vencimiento) : null
                      return (
                        <tr key={ct.id} className="border-b border-[#1F1F1F] last:border-0 hover:bg-[#1A1A1A]">
                          <td className="px-5 py-3 text-[#9CA3AF] text-xs whitespace-nowrap">
                            {ct.fecha_alta ? formatDate(ct.fecha_alta) : '—'}
                          </td>
                          <td className="px-5 py-3 text-[#9CA3AF] text-xs whitespace-nowrap">
                            {ct.fecha_vencimiento ? formatDate(ct.fecha_vencimiento) : '—'}
                          </td>
                          <td className="px-5 py-3 text-[#9CA3AF] text-xs">
                            {ct.duracion_meses ? `${ct.duracion_meses} meses` : '—'}
                          </td>
                          <td className="px-5 py-3">
                            {dias !== null && meses !== null ? (
                              <span className={`text-xs font-semibold ${
                                ct.renovacion_verificada ? 'text-[#6B7280]' :
                                dias < 0  ? 'text-red-400' :
                                dias <= 30 ? 'text-yellow-400' : 'text-[#00E676]'
                              }`}>
                                {ct.renovacion_verificada ? 'Verificado' :
                                 dias < 0 ? `Vencido hace ${Math.abs(dias)}d` :
                                 meses <= 0 ? `${dias}d` :
                                 `${meses} ${meses === 1 ? 'mes' : 'meses'}`}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-5 py-3 text-[#9CA3AF]">{ct.comercializadora ?? '—'}</td>
                          <td className="px-5 py-3 text-[#9CA3AF]">{ct.producto ?? '—'}</td>
                          <td className="px-5 py-3">
                            <div className={`flex items-center gap-1.5 text-xs ${ct.renovacion_verificada ? 'text-[#00E676]' : 'text-[#6B7280]'}`}>
                              <FileCheck className="w-3.5 h-3.5" />
                              {ct.renovacion_verificada ? 'Verificado' : 'Pendiente'}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Facturas */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1F1F1F] flex items-center justify-between">
              <h2 className="text-white font-semibold">Historial de facturas</h2>
              <Link href="/dashboard/nueva-factura">
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" />Nueva
                </Button>
              </Link>
            </div>
            {facturas.length === 0 ? (
              <div className="py-12 text-center text-[#6B7280] text-sm">No hay facturas procesadas aún.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1F1F1F]">
                      {['Periodo', 'Importe', 'kWh', 'Ahorro estimado', 'Fee', ''].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map((f) => (
                      <tr key={f.id} className="border-b border-[#1F1F1F] last:border-0 hover:bg-[#1A1A1A]">
                        <td className="px-5 py-3 text-[#9CA3AF] text-xs">
                          {f.fecha_inicio ? `${formatDate(f.fecha_inicio)} – ${formatDate(f.fecha_fin!)}` : '—'}
                        </td>
                        <td className="px-5 py-3 text-white font-medium">{f.total_factura ? formatCurrency(f.total_factura) : '—'}</td>
                        <td className="px-5 py-3 text-[#9CA3AF]">{f.kwh_total?.toLocaleString('es-ES') ?? '—'}</td>
                        <td className="px-5 py-3 text-[#00E676] font-medium">{f.ahorro_estimado_anual ? formatCurrency(f.ahorro_estimado_anual) : '—'}</td>
                        <td className="px-5 py-3 text-[#9CA3AF]">{f.fee_aplicado ?? '—'} €/MWh</td>
                        <td className="px-5 py-3">
                          {f.pdf_url && (
                            <a href={f.pdf_url} target="_blank" rel="noopener noreferrer" className="text-[#6B7280] hover:text-[#00E676]">
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Facturas del contrato */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1F1F1F] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#00E676]" />
                <h2 className="text-white font-semibold">Facturas del contrato</h2>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleUploadFactura(file)
                    e.target.value = ''
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFactura}
                >
                  {uploadingFactura
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Upload className="w-3.5 h-3.5" />}
                  {uploadingFactura ? 'Procesando…' : 'Subir PDF'}
                </Button>
              </div>
            </div>

            {facturasContrato.length === 0 ? (
              <div className="py-10 text-center text-[#6B7280] text-sm">
                {uploadingFactura
                  ? <div className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-[#00E676]" /><span>Extrayendo datos con IA…</span></div>
                  : 'No hay facturas subidas aún. Sube un PDF para extraer los datos automáticamente.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1F1F1F]">
                      {['Período', 'Nº Factura', 'Importe', 'kWh', '€/kWh', 'Ahorro', ''].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {facturasContrato.map((f) => (
                      <tr key={f.id} className="border-b border-[#1F1F1F] last:border-0 hover:bg-[#1A1A1A]">
                        <td className="px-5 py-3 text-[#9CA3AF] text-xs whitespace-nowrap">
                          {f.periodo_inicio && f.periodo_fin
                            ? `${formatDate(f.periodo_inicio)} – ${formatDate(f.periodo_fin)}`
                            : f.fecha_factura ? formatDate(f.fecha_factura) : '—'}
                        </td>
                        <td className="px-5 py-3 text-[#9CA3AF] font-mono text-xs">{f.numero_factura ?? '—'}</td>
                        <td className="px-5 py-3 text-white font-medium">{f.importe_total ? formatCurrency(f.importe_total) : '—'}</td>
                        <td className="px-5 py-3 text-[#9CA3AF]">{f.kwh_total?.toLocaleString('es-ES') ?? '—'}</td>
                        <td className="px-5 py-3 text-[#9CA3AF] font-mono text-xs">
                          {f.precio_kwh_efectivo ? `${(f.precio_kwh_efectivo * 1000).toFixed(2)} €/MWh` : '—'}
                        </td>
                        <td className="px-5 py-3">
                          {f.ahorro_vs_anterior !== null && f.ahorro_vs_anterior !== undefined ? (
                            <span className={`text-xs font-semibold ${f.ahorro_vs_anterior >= 0 ? 'text-[#00E676]' : 'text-red-400'}`}>
                              {f.ahorro_vs_anterior >= 0 ? '+' : ''}{formatCurrency(f.ahorro_vs_anterior)}
                            </span>
                          ) : <span className="text-[#6B7280] text-xs">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          {f.pdf_url && (
                            <a href={f.pdf_url} target="_blank" rel="noopener noreferrer" className="text-[#6B7280] hover:text-[#00E676] transition-colors">
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Acciones / Log de contactos */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1F1F1F]">
              <h2 className="text-white font-semibold">Registro de contactos</h2>
            </div>

            {/* Formulario rápido */}
            <div className="px-6 py-4 border-b border-[#1F1F1F] space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1">Tipo</label>
                  <Select value={accionTipo} onValueChange={v => setAccionTipo(v as AccionTipoVal)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TIPO_LABELS) as AccionTipoVal[]).map(t => (
                        <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1">Resultado</label>
                  <Select value={accionResultado} onValueChange={v => setAccionResultado(v as AccionResultadoVal)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(RESULTADO_LABELS) as AccionResultadoVal[]).map(r => (
                        <SelectItem key={r} value={r}>{RESULTADO_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  value={accionNotas}
                  onChange={e => setAccionNotas(e.target.value)}
                  placeholder="Notas de la llamada / reunión..."
                  className="text-sm h-8"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveAccion() }}}
                />
                <Button size="sm" onClick={handleSaveAccion} disabled={savingAccion} className="gap-1.5 shrink-0 h-8">
                  {savingAccion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Registrar
                </Button>
              </div>
            </div>

            {/* Historial */}
            {acciones.length === 0 ? (
              <div className="py-8 text-center text-[#6B7280] text-sm">Sin acciones registradas aún.</div>
            ) : (
              <div className="divide-y divide-[#1F1F1F]">
                {acciones.map((a) => {
                  const Icon = TIPO_ICONS[a.tipo]
                  return (
                    <div key={a.id} className="flex items-start gap-3 px-6 py-3">
                      <div className="mt-0.5 w-7 h-7 rounded-full bg-[#1A1A1A] flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-[#6B7280]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-medium">{TIPO_LABELS[a.tipo]}</span>
                          <span className={`text-xs font-medium ${RESULTADO_COLOR[a.resultado]}`}>
                            {RESULTADO_LABELS[a.resultado]}
                          </span>
                          <span className="text-[#6B7280] text-xs ml-auto">{formatDate(a.fecha)}</span>
                        </div>
                        {a.notas && <p className="text-[#9CA3AF] text-sm mt-0.5 truncate">{a.notas}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* Right panel */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="w-full xl:w-80 space-y-5">

          {/* Datos personales */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4">Datos personales</h2>
            <div className="space-y-3">
              {([
                { label: 'Nombre completo',       value: nombre,   set: setNombre,   type: 'text' },
                { label: 'Empresa / razón social', value: empresa, set: setEmpresa,  type: 'text' },
                { label: 'NIF / DNI / CIF',        value: nif,     set: setNif,      type: 'text' },
                { label: 'Email',                  value: email,   set: setEmail,    type: 'email' },
                { label: 'Teléfono fijo',          value: telefono, set: setTelefono, type: 'tel' },
                { label: 'Móvil',                  value: movil,   set: setMovil,    type: 'tel' },
              ] as const).map(({ label, value, set, type }) => (
                <div key={label}>
                  <label className="block text-xs text-[#9CA3AF] mb-1">{label}</label>
                  <Input type={type} value={value} onChange={(e) => (set as (v: string) => void)(e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          {/* Dirección */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4">Dirección</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1">Dirección</label>
                <Input value={direccion} placeholder="Calle Mayor 1, 2º B" onChange={(e) => setDireccion(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1">CP</label>
                  <Input value={cp} placeholder="48950" onChange={(e) => setCp(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1">Localidad</label>
                  <Input value={poblacion} placeholder="Bilbao" onChange={(e) => setPoblacion(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1">Provincia</label>
                <Input value={provincia} placeholder="Vizcaya" onChange={(e) => setProvincia(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Suministro */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4">Suministro</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1">CUPS</label>
                <Input value={cups} placeholder="ES0021..." onChange={(e) => setCups(e.target.value)} className="font-mono text-xs" />
              </div>
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1">Comercializadora actual</label>
                <Input value={comercializadora} onChange={(e) => setComercializadora(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Datadis */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#00E676]" />
                <h2 className="text-white font-semibold">Datadis</h2>
              </div>
              {autorizacionDatadis && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5 h-7 text-xs"
                  onClick={handleSyncDatadis}
                  disabled={syncingDatadis}
                >
                  {syncingDatadis
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <RefreshCw className="w-3 h-3" />}
                  Sincronizar
                </Button>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1">Fecha autorización</label>
                <Input type="date" value={autorizacionDatadis} onChange={e => setAutorizacionDatadis(e.target.value)} />
              </div>
              {ultimaSyncDatadis && (
                <p className="text-xs text-[#6B7280]">
                  Última sync: {formatDate(ultimaSyncDatadis)}
                </p>
              )}
              {consumosDatadis.length > 0 && (() => {
                const chartData = [...consumosDatadis]
                  .sort((a, b) => a.year_month.localeCompare(b.year_month))
                  .map(c => ({
                    mes: c.year_month.slice(2).replace('-', '/'),
                    kwh: c.kwh_total,
                  }))
                const maxKwh = Math.max(...chartData.map(d => d.kwh))
                const totalAnual = consumosDatadis.reduce((s, c) => s + c.kwh_total, 0)
                return (
                  <div className="mt-3">
                    <div className="flex items-baseline justify-between mb-2">
                      <p className="text-xs text-[#9CA3AF]">Consumo mensual (kWh)</p>
                      <p className="text-xs text-[#6B7280]">
                        Total: <span className="text-white font-mono">{Math.round(totalAnual).toLocaleString('es-ES')} kWh</span>
                      </p>
                    </div>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={chartData} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: '#1F1F1F', border: '1px solid #2A2A2A', borderRadius: 8, fontSize: 12 }}
                          labelStyle={{ color: '#9CA3AF' }}
                          itemStyle={{ color: '#00E676' }}
                          formatter={(v: number) => [`${v.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kWh`, '']}
                        />
                        <Bar dataKey="kwh" radius={[3, 3, 0, 0]}>
                          {chartData.map((d) => (
                            <Cell key={d.mes} fill={d.kwh === maxKwh ? '#00E676' : '#1565C0'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              })()}
              {!autorizacionDatadis && (
                <p className="text-xs text-[#6B7280]">Añade la fecha de autorización para activar la sincronización.</p>
              )}
            </div>
          </div>

          {/* Gestión */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4">Gestión</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-2">Estado</label>
                <Select value={estado} onValueChange={(v) => setEstado(v as ClienteEstado)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-2">Próximo contacto</label>
                <Input type="date" value={proximoContacto} onChange={(e) => setProximoContacto(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-2">Notas</label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] px-3 py-2 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#00E676] resize-none"
                  placeholder="Notas internas..."
                />
              </div>
            </div>
          </div>

          {/* Cartera / fee */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4">Datos de cartera</h2>
            <div className="space-y-3">
              {([
                { label: 'Fee energía (€/MWh)',     value: feeEnergia,          set: setFeeEnergia,          step: '0.5' },
                { label: 'Fee potencia (€/kW·año)', value: feePotencia,         set: setFeePotencia,         step: '0.1' },
                { label: 'kWh anuales',             value: kwhAnuales,          set: setKwhAnuales,          step: '1000' },
                { label: 'kW contratados',          value: kwContratados,       set: setKwContratados,       step: '0.5' },
              ] as const).map(({ label, value, set, step }) => (
                <div key={label}>
                  <label className="block text-xs text-[#9CA3AF] mb-1">{label}</label>
                  <Input type="number" step={step} value={value} onChange={(e) => (set as (v: string) => void)(e.target.value)} />
                </div>
              ))}
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1">Inicio contrato</label>
                <Input type="date" value={fechaInicioContrato} onChange={(e) => setFechaInicioContrato(e.target.value)} />
              </div>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar cambios
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
