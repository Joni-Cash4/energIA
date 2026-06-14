'use client'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Zap } from 'lucide-react'

const data = [
  {
    name: 'Tarifa fija',
    energia: 62,
    peajes: 18,
    impuestos: 20,
  },
  {
    name: 'Tarifa indexada',
    energia: 48,
    peajes: 18,
    impuestos: 20,
  },
]

const COLORS = {
  energia: '#1565C0',
  peajes: '#2196F3',
  impuestos: '#5C6BC0',
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-white font-medium mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill }} className="flex justify-between gap-4">
          <span className="capitalize">{p.name}</span>
          <span className="font-semibold">{p.value}%</span>
        </p>
      ))}
    </div>
  )
}

export function Transparencia() {
  return (
    <section className="py-24 bg-[#0D0D0D] border-y border-[#1F1F1F]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-[#00E676] text-sm uppercase tracking-widest mb-3">Transparencia</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            ¿Cuánto pagas realmente?
          </h2>
          <p className="text-[#9CA3AF] text-lg max-w-2xl mx-auto">
            Tu factura eléctrica tiene tres componentes: energía, peajes de red e impuestos.
            Entender cada uno te ayuda a tomar mejores decisiones.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6"
          >
            <h3 className="text-white font-semibold mb-6 text-sm uppercase tracking-wide">
              Composición del precio (% orientativo)
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Legend
                  formatter={(v) => <span className="text-xs text-[#9CA3AF] capitalize">{v}</span>}
                  wrapperStyle={{ paddingTop: 16 }}
                />
                <Bar dataKey="energia"   name="Energía"   stackId="a" fill={COLORS.energia}   radius={[0,0,0,0]} />
                <Bar dataKey="peajes"    name="Peajes"    stackId="a" fill={COLORS.peajes}    />
                <Bar dataKey="impuestos" name="Impuestos" stackId="a" fill={COLORS.impuestos} radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Comparison cards */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col gap-4"
          >
            <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#1565C0]/15 flex items-center justify-center">
                  <span className="text-[#2196F3] text-lg">🔒</span>
                </div>
                <h3 className="text-white font-semibold">Tarifa fija</h3>
              </div>
              <ul className="space-y-2 text-sm text-[#9CA3AF]">
                <li className="flex items-start gap-2">
                  <span className="text-[#6B7280] mt-0.5">·</span>
                  Precio por kWh pactado y estable durante el periodo contratado
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#6B7280] mt-0.5">·</span>
                  Protege ante subidas del mercado
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#6B7280] mt-0.5">·</span>
                  No te beneficias si el mercado baja
                </li>
              </ul>
            </div>

            <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#00E676]/15 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[#00E676]" />
                </div>
                <h3 className="text-white font-semibold">Tarifa indexada</h3>
              </div>
              <ul className="space-y-2 text-sm text-[#9CA3AF]">
                <li className="flex items-start gap-2">
                  <span className="text-[#6B7280] mt-0.5">·</span>
                  Pagas el precio real del mercado OMIE cada hora
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#6B7280] mt-0.5">·</span>
                  Se beneficia de bajadas del mercado
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#6B7280] mt-0.5">·</span>
                  Más variable — puede ser más cara en meses de precios altos
                </li>
              </ul>
            </div>

            <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-5">
              <p className="text-[#9CA3AF] text-sm">
                Analizamos tu consumo y tu situación para recomendarte la opción que más te conviene,
                sin sesgo hacia ninguna modalidad.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
