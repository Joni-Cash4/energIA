'use client'
import { motion } from 'framer-motion'
import { Building2, TrendingDown } from 'lucide-react'

// DATOS DE EJEMPLO — sustituir por casos reales con consentimiento del cliente.
// foto y fotoNegocio son opcionales: sin foto se muestran las iniciales / un placeholder.
// Las imágenes van en public/casos/ (p. ej. foto: '/casos/maria-g.jpg')

interface Testimonio {
  cita: string
  nombre: string
  negocio: string
  ahorroPct?: number
  ahorroTxt?: string
  foto?: string
}

interface CasoDestacado {
  etiqueta: string
  cita: string
  ahorroAnual?: number
  ahorroPct?: number
  nombre: string
  cargo: string
  foto?: string
  fotoNegocio?: string
}

// CASO REAL — Mariano Gómez Pérez, Bar Restaurante La Carranzana (desde 1959)
const casoDestacado: CasoDestacado = {
  etiqueta: 'Caso real · Bar Restaurante La Carranzana, desde 1959',
  cita: 'Desde que empezamos a revisar facturas, mirando cambios de tarifa y estudiando operadores, tenemos más tranquilidad: hay un poco de ahorro y lo tenemos claro.',
  nombre: 'Mariano G.',
  cargo: 'Restauración',
  fotoNegocio: '/casos/la-carranzana.webp',
}

// Formato de cada entrada:
// { cita: '...', nombre: 'Nombre I.', negocio: 'Tipo de negocio', ahorroPct: 18, ahorroTxt: 'texto libre para el badge', foto: '/casos/x.webp' }
// (ahorroPct, ahorroTxt y foto son opcionales)
const testimonios: Testimonio[] = [
  // CASO REAL — Jokin, gerente de Makailo Etxarri SL (bacalao)
  {
    cita: 'Tenemos neveras que consumen bastante, pero no sabía interpretar las facturas. Jonathan me pidió un par y en 5 minutos me dijo: «tenéis potencia contratada de más, y vuestra compañía no tiene precios competitivos». Ajustamos potencias, buscamos mejores tarifas y el ahorro fue importante. Desde entonces se encarga cada año de buscarnos las mejores tarifas.',
    nombre: 'Jokin',
    negocio: 'Gerente · Makailo Etxarri',
    ahorroTxt: '80-90 € de ahorro al mes',
    foto: '/casos/makailo-etxarri.jpg',
  },
]

function iniciales(nombre: string) {
  return nombre
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function Avatar({ nombre, foto, size = 'md' }: { nombre: string; foto?: string; size?: 'md' | 'sm' }) {
  const cls = size === 'md' ? 'w-11 h-11 text-sm' : 'w-9 h-9 text-xs'
  if (foto) {
    return <img src={foto} alt={nombre} className={`${cls} rounded-full object-cover shrink-0`} />
  }
  return (
    <div
      className={`${cls} rounded-full bg-[#00E676]/10 text-[#00E676] font-semibold flex items-center justify-center shrink-0`}
    >
      {iniciales(nombre)}
    </div>
  )
}

export function CasosReales() {
  return (
    <section className="py-24 border-y border-[#1F1F1F]" id="casos">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-[#00E676] text-sm uppercase tracking-widest mb-3">Casos reales</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Negocios que ya pagan menos
          </h2>
          <p className="text-[#9CA3AF] text-lg max-w-2xl mx-auto">
            Sin promesas: facturas reales, antes y después. Estos son algunos de los
            resultados de nuestros clientes.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="card overflow-hidden grid md:grid-cols-5 mb-8"
        >
          <div className="md:col-span-2 min-h-[220px] relative">
            {casoDestacado.fotoNegocio ? (
              <img
                src={casoDestacado.fotoNegocio}
                alt={casoDestacado.etiqueta}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[#0D0D0D] flex flex-col items-center justify-center gap-3 text-[#6B7280]">
                <Building2 className="w-8 h-8" />
                <span className="text-xs">Foto del negocio</span>
              </div>
            )}
          </div>
          <div className="md:col-span-3 p-6 sm:p-8">
            <p className="text-[#6B7280] text-sm mb-3">{casoDestacado.etiqueta}</p>
            <blockquote className="text-white text-lg sm:text-xl leading-relaxed mb-6">
              &ldquo;{casoDestacado.cita}&rdquo;
            </blockquote>
            {(casoDestacado.ahorroAnual || casoDestacado.ahorroPct) && (
              <div className="flex flex-wrap gap-3 mb-6">
                {casoDestacado.ahorroAnual && (
                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl px-4 py-2.5">
                    <p className="text-[#6B7280] text-xs mb-0.5">Ahorro anual</p>
                    <p className="text-[#00E676] text-xl font-bold">
                      {casoDestacado.ahorroAnual.toLocaleString('es-ES')} €
                    </p>
                  </div>
                )}
                {casoDestacado.ahorroPct && (
                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl px-4 py-2.5">
                    <p className="text-[#6B7280] text-xs mb-0.5">Reducción</p>
                    <p className="text-[#00E676] text-xl font-bold">−{casoDestacado.ahorroPct}%</p>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-3">
              <Avatar nombre={casoDestacado.nombre} foto={casoDestacado.foto} size="sm" />
              <p className="text-[#9CA3AF] text-sm">
                {casoDestacado.nombre} · {casoDestacado.cargo}
              </p>
            </div>
          </div>
        </motion.div>

        {testimonios.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonios.map((t, i) => (
            <motion.div
              key={t.nombre}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="card p-6 flex flex-col"
            >
              <blockquote className="text-[#D1D5DB] leading-relaxed mb-6 flex-1">
                &ldquo;{t.cita}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3 mb-4">
                <Avatar nombre={t.nombre} foto={t.foto} />
                <div>
                  <p className="text-white text-sm font-medium">{t.nombre}</p>
                  <p className="text-[#6B7280] text-xs">{t.negocio}</p>
                </div>
              </div>
              {(t.ahorroPct || t.ahorroTxt) && (
                <div className="inline-flex items-center gap-1.5 self-start bg-[#00E676]/10 text-[#00E676] text-xs font-semibold px-3 py-1.5 rounded-full">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {t.ahorroTxt ?? `−${t.ahorroPct}% en su factura`}
                </div>
              )}
            </motion.div>
          ))}
        </div>
        )}
      </div>
    </section>
  )
}
