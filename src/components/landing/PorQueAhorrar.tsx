'use client'
import { motion } from 'framer-motion'
import { Zap, TrendingDown, Clock, AlertTriangle } from 'lucide-react'

const insights = [
  {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    titulo: 'El término de potencia: el gran desconocido',
    texto:
      'Entre el 30-40% de tu factura no depende de lo que consumes — depende de la potencia que tienes contratada. La mayoría de empresas la tienen sobredimensionada o con márgenes comerciales añadidos sin saberlo.',
  },
  {
    icon: TrendingDown,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    titulo: '¿Tarifa fija o indexada? No es lo mismo siempre',
    texto:
      'Una tarifa indexada te da el precio real del mercado OMIE cada hora. Una tarifa fija te da certeza. La mejor opción depende de tu perfil de consumo — y muy pocos asesores hacen el cálculo de verdad con tu factura real.',
  },
  {
    icon: Zap,
    color: 'text-[#00E676]',
    bg: 'bg-[#00E676]/10',
    titulo: 'Cada periodo tarifario tiene un precio diferente',
    texto:
      'En 3.0TD hay 6 periodos (P1-P6). Tu consumo en P1 puede costar 3 veces más que en P6. Si tu actividad se concentra en punta y nadie te ha optimizado el horario, estás pagando de más cada mes.',
  },
  {
    icon: Clock,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    titulo: 'Tu comercializadora añade su margen encima de todo',
    texto:
      'Los peajes y cargos los fija el BOE — son iguales para todos. Pero sobre eso, cada comercializadora añade su margen. Analizamos ese margen oculto en segundos con tu propia factura.',
  },
]

export function PorQueAhorrar() {
  return (
    <section className="py-24 bg-[#0A0A0A]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-[#6B7280] text-sm uppercase tracking-widest mb-4">
            Lo que nadie te explica
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            ¿Por qué sigues pagando de más?
          </h2>
          <p className="mt-4 text-[#9CA3AF] max-w-2xl mx-auto">
            La factura eléctrica tiene capas que pocas empresas se molestan en revisar.
            Aquí están las cuatro razones más comunes.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {insights.map((item, i) => {
            const Icon = item.icon
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#111111] border border-[#1F1F1F] rounded-2xl p-6 flex gap-5 hover:border-[#2A2A2A] transition-colors"
              >
                <div className={`${item.bg} rounded-xl p-3 h-fit shrink-0`}>
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-2">{item.titulo}</h3>
                  <p className="text-[#9CA3AF] text-sm leading-relaxed">{item.texto}</p>
                </div>
              </motion.div>
            )
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="text-[#6B7280] text-sm">
            Sube tu factura y te mostramos exactamente cuánto estás pagando de más — y por qué.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
