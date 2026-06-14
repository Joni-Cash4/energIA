'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Calculator, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'

const COMERCIALIZADORAS = [
  'Endesa', 'Iberdrola', 'Naturgy', 'Repsol', 'EDP', 'Holaluz',
  'Octopus Energy', 'Podo', 'Lucera', 'Otra',
]

const AHORRO_MEDIO = 0.21

export function Calculadora() {
  const router = useRouter()
  const [importe, setImporte] = useState('')
  const [tarifa, setTarifa] = useState('')
  const [comercializadora, setComercializadora] = useState('')
  const [resultado, setResultado] = useState<number | null>(null)

  const calcular = () => {
    const mensual = parseFloat(importe)
    if (!mensual || mensual <= 0) return
    setResultado(mensual * 12 * AHORRO_MEDIO)
  }

  const mesesEquivalente = resultado ? Math.round(resultado / (parseFloat(importe) || 1)) : 0

  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-[#00E676] text-sm uppercase tracking-widest mb-3">Sin subir nada</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Estimación rápida de ahorro
          </h2>
          <p className="text-[#9CA3AF] text-lg max-w-xl mx-auto">
            Introduce tu importe mensual para una estimación orientativa.
            Para un análisis real y personalizado, sube tu factura.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-8"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-[#00E676]" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Calculadora rápida</h3>
              <p className="text-[#6B7280] text-sm">Estimación orientativa · ahorro medio 21%</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-2">Importe mensual (€)</label>
              <Input
                type="number"
                value={importe}
                onChange={(e) => { setImporte(e.target.value); setResultado(null) }}
                placeholder="Ej: 120"
                min={1}
              />
            </div>
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-2">Tipo de tarifa</label>
              <Select value={tarifa} onValueChange={setTarifa}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2.0TD">2.0TD (doméstica)</SelectItem>
                  <SelectItem value="3.0TD">3.0TD (empresa)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-2">Comercializadora actual</label>
              <Select value={comercializadora} onValueChange={setComercializadora}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {COMERCIALIZADORAS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={calcular} disabled={!importe} className="w-full sm:w-auto">
            Calcular ahorro estimado
          </Button>

          <AnimatePresence>
            {resultado !== null && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-[#1F1F1F] pt-6">
                  <div className="grid sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-[#0F0F0F] rounded-xl p-4 text-center">
                      <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Pagas ahora</p>
                      <p className="text-2xl font-bold text-white">
                        {formatCurrency(parseFloat(importe) * 12, 0)}/año
                      </p>
                    </div>
                    <div className="bg-[#00E676]/5 border border-[#00E676]/20 rounded-xl p-4 text-center">
                      <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Ahorro estimado</p>
                      <p className="text-2xl font-bold text-[#00E676]">
                        {formatCurrency(resultado, 0)}/año
                      </p>
                    </div>
                    <div className="bg-[#0F0F0F] rounded-xl p-4 text-center">
                      <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-1">Equivale a</p>
                      <p className="text-2xl font-bold text-white">
                        {mesesEquivalente} meses gratis
                      </p>
                    </div>
                  </div>
                  <p className="text-[#6B7280] text-xs mb-4">
                    * Estimación basada en el ahorro medio del 21% de nuestros clientes.
                    El ahorro real depende de tu consumo y comercializadora actual.
                  </p>
                  <Button
                    size="lg"
                    onClick={() => router.push('/comparador')}
                    className="gap-2"
                  >
                    Quiero el análisis completo gratuito
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  )
}
