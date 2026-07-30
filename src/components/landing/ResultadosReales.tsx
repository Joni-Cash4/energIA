'use client'
import { motion } from 'framer-motion'
import { Search, Wrench, TrendingDown } from 'lucide-react'

interface Caso {
  negocio: string
  tipo: string
  foto?: string
  detectamos: string
  hicimos: string
  resultado: string
}

// CASOS REALES documentados y con consentimiento (ya estuvieron publicados en la web anterior).
// Fotos en /public/casos/. Cifras extraídas de los testimonios reales de cada cliente.
const casos: Caso[] = [
  {
    negocio: 'Makailo Etxarri',
    tipo: 'Pescadería · bacalao',
    foto: '/casos/makailo-etxarri.jpg',
    detectamos:
      'Potencia contratada por encima de la que realmente usaban y una comercializadora con precios poco competitivos.',
    hicimos:
      'Ajustamos la potencia a su consumo real y les buscamos una tarifa mejor. Desde entonces revisamos sus condiciones cada año.',
    resultado: '80–90 € de ahorro al mes',
  },
  {
    negocio: 'Zuberoa Janaridenda',
    tipo: 'Supermercado',
    foto: '/casos/zuberoa-janaridenda.webp',
    detectamos: 'Una factura con mucho margen de mejora: pagaba unos 3.000 € de luz al mes.',
    hicimos:
      'Revisamos la factura, le conseguimos mejores condiciones y seguimos vigilando el precio para cambiarlo cuando aparece una mejora.',
    resultado: 'De 3.000 € a 1.700 € al mes',
  },
  {
    negocio: 'Bar Restaurante La Carranzana',
    tipo: 'Restauración · desde 1959',
    foto: '/casos/la-carranzana.webp',
    detectamos: 'Un contrato que llevaba tiempo sin revisar y sin seguimiento de las tarifas.',
    hicimos:
      'Empezamos a revisar sus facturas periódicamente, comparando tarifas y operadores a lo largo del año.',
    resultado: 'Ahorro estable y tranquilidad',
  },
]

export function ResultadosReales() {
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Algunos resultados reales</h2>
          <p className="text-[#9CA3AF] text-lg max-w-2xl mx-auto">
            Cada empresa es diferente, pero estos son algunos ejemplos reales de situaciones que
            hemos detectado y resuelto para nuestros clientes.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {casos.map((c, i) => (
            <motion.div
              key={c.negocio}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className="flex flex-col bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden hover:border-[#00E676]/30 transition-colors"
            >
              {c.foto && (
                <div className="relative h-40">
                  <img src={c.foto} alt={c.negocio} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/20 to-transparent" />
                </div>
              )}

              <div className="p-6 flex flex-col flex-1">
                <h3 className="text-lg font-semibold text-white">{c.negocio}</h3>
                <p className="text-[#6B7280] text-xs mb-5">{c.tipo}</p>

                <div className="space-y-4 flex-1">
                  <div className="flex items-start gap-3">
                    <Search className="w-4 h-4 text-[#00E676] shrink-0 mt-1" />
                    <div>
                      <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-0.5">Qué detectamos</p>
                      <p className="text-[#D1D5DB] text-sm leading-relaxed">{c.detectamos}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Wrench className="w-4 h-4 text-[#00E676] shrink-0 mt-1" />
                    <div>
                      <p className="text-[#6B7280] text-xs uppercase tracking-wide mb-0.5">Qué hicimos</p>
                      <p className="text-[#D1D5DB] text-sm leading-relaxed">{c.hicimos}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-5 border-t border-[#1F1F1F]">
                  <div className="inline-flex items-center gap-2 bg-[#00E676]/10 text-[#00E676] font-semibold px-3.5 py-2 rounded-full text-sm">
                    <TrendingDown className="w-4 h-4" />
                    {c.resultado}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
