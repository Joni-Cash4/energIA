'use client'
import { useEffect, useState, useCallback } from 'react'
import { KeyRound, Loader2, User, Bot } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import { useToast } from '@/lib/use-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { AccesoPlataforma } from '@/types'

const PLATAFORMAS = ['TotalEnergies', 'Próxima', 'Atulado', 'Gana Energía', 'Nordy Energía', 'WolfCRM AE2000', 'Otra']

function formatFechaHora(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d)
}

export default function AccesosPage() {
  const { toast } = useToast()
  const [accesos, setAccesos] = useState<AccesoPlataforma[]>([])
  const [loading, setLoading] = useState(true)
  const [plataforma, setPlataforma] = useState('')
  const [plataformaLibre, setPlataformaLibre] = useState('')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = getSupabaseClient()
    const { data } = await supabase
      .from('accesos_plataforma')
      .select('*')
      .order('fecha_hora', { ascending: false })
      .limit(100)
    setAccesos((data ?? []) as AccesoPlataforma[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function registrarAcceso() {
    const nombrePlataforma = plataforma === 'Otra' ? plataformaLibre.trim() : plataforma
    if (!nombrePlataforma) {
      toast({ title: 'Selecciona o escribe una plataforma', variant: 'destructive' })
      return
    }
    setGuardando(true)
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('accesos_plataforma').insert({
      user_id: user!.id,
      plataforma: nombrePlataforma,
      actor: 'jonathan',
      origen: 'manual',
      nota: nota.trim() || null,
    })
    if (error) {
      toast({ title: 'Error al registrar el acceso', variant: 'destructive' })
    } else {
      setPlataforma('')
      setPlataformaLibre('')
      setNota('')
      await load()
    }
    setGuardando(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-[#00E676]/30 border-t-[#00E676] animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-[#00E676]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Accesos</h1>
          <p className="text-[#6B7280] text-sm">Registro de cuándo se entra en Próxima, TotalEnergies, WolfCRM y demás plataformas</p>
        </div>
      </div>

      {/* Registrar acceso */}
      <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-5 mb-8">
        <h2 className="text-white font-semibold text-sm mb-3">Registrar acceso</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-52">
            <label className="block text-[10px] text-[#9CA3AF] mb-1 uppercase tracking-wide">Plataforma</label>
            <Select value={plataforma} onValueChange={setPlataforma}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent>
                {PLATAFORMAS.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {plataforma === 'Otra' && (
            <div className="w-52">
              <label className="block text-[10px] text-[#9CA3AF] mb-1 uppercase tracking-wide">Nombre</label>
              <Input value={plataformaLibre} onChange={e => setPlataformaLibre(e.target.value)} placeholder="Nombre de la plataforma" />
            </div>
          )}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] text-[#9CA3AF] mb-1 uppercase tracking-wide">Nota (opcional)</label>
            <Input value={nota} onChange={e => setNota(e.target.value)} placeholder="Qué revisaste o hiciste…" />
          </div>
          <button
            onClick={registrarAcceso}
            disabled={guardando}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#00E676] text-black hover:bg-[#00c765] disabled:opacity-40 h-9"
          >
            {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
            Registrar
          </button>
        </div>
      </div>

      {/* Listado */}
      <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1F1F1F]">
          <h2 className="text-white font-semibold">Últimos accesos</h2>
        </div>
        {accesos.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#1F1F1F] flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-[#6B7280]" />
            </div>
            <p className="text-[#6B7280] text-sm">Todavía no hay accesos registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1F1F1F]">
                  {['Fecha/hora', 'Plataforma', 'Quién', 'Nota'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs text-[#6B7280] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accesos.map(a => (
                  <tr key={a.id} className="border-b border-[#1A1A1A] last:border-0">
                    <td className="px-4 py-2.5 text-[#9CA3AF] text-xs whitespace-nowrap">{formatFechaHora(a.fecha_hora)}</td>
                    <td className="px-4 py-2.5 text-white text-sm whitespace-nowrap">{a.plataforma}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${
                        a.actor === 'claude'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-[#00E676]/10 text-[#00E676] border-[#00E676]/20'
                      }`}>
                        {a.actor === 'claude' ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {a.actor === 'claude' ? 'Claude' : 'Jonathan'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[#9CA3AF] text-xs">{a.nota ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
