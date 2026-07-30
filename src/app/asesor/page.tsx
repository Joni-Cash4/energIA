import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { MapPin, Clock, Video, Star, ArrowRight, CheckCircle, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Tu asesor energético',
  description:
    'Jonathan, asesor energético detrás de IAenergía. Superviso la energía de tu empresa durante todo el año, con transparencia total sobre cómo trabajamos y cómo cobramos.',
}

const WHATSAPP_ASESOR =
  'https://wa.me/34689880596?text=' +
  encodeURIComponent('Hola Jonathan, me gustaría que revisáramos la energía de mi empresa.')

// Casos reales — mismos testimonios que src/components/landing/ResultadosReales.tsx
const reseñas = [
  { nombre: 'Mariano G.', lugar: 'Bar Restaurante La Carranzana', texto: 'Desde que empezamos a revisar facturas, mirando cambios de tarifa y estudiando operadores, tenemos más tranquilidad: hay un poco de ahorro y lo tenemos claro.', estrellas: 5 },
  { nombre: 'Jokin', lugar: 'Gerente · Makailo Etxarri', texto: 'Tenemos neveras que consumen bastante, pero no sabía interpretar las facturas. Jonathan me pidió un par y en 5 minutos me dijo: «tenéis potencia contratada de más, y vuestra compañía no tiene precios competitivos». Ajustamos potencias, buscamos mejores tarifas y el ahorro fue importante.', estrellas: 5 },
  { nombre: 'Masus', lugar: 'Gerenta · Zuberoa Janaridenda', texto: 'Tengo un supermercado y pagaba 3.000 € de luz. Jonathan me revisó la factura y empecé a pagar 1.700 €. Y el servicio es inmejorable, porque si hay alguna mejora en el precio, se preocupa él de cambiártelo.', estrellas: 5 },
]

export default function AsesorPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-16 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto py-14">

          {/* Hero asesor */}
          <div className="flex flex-col md:flex-row items-center gap-10 mb-16">
            {/* Foto */}
            <div className="shrink-0 relative">
              <div className="absolute -inset-2 bg-[#00E676]/10 rounded-full blur-2xl pointer-events-none" />
              <Image
                src="/asesor/Foto perfil.png"
                alt="Jonathan, asesor energético de IAenergía"
                width={192}
                height={192}
                className="relative w-44 h-44 rounded-full object-cover border border-[#00E676]/20"
                style={{ objectPosition: 'center 20%' }}
              />
            </div>
            <div>
              <p className="text-[#00E676] text-sm uppercase tracking-widest mb-2">Tu asesor energético</p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Jonathan</h1>
              <p className="text-[#9CA3AF] text-lg mb-4 leading-relaxed">
                Desde 2014 ayudo a empresas a entender, optimizar y controlar su energía. No vendo
                electricidad: superviso la energía de tu empresa durante todo el año y te aviso solo
                cuando de verdad merece la pena tomar una decisión.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="flex items-center gap-1.5 text-sm text-[#9CA3AF]">
                  <MapPin className="w-4 h-4 text-[#00E676]" />
                  Bilbao · País Vasco
                </span>
                <span className="flex items-center gap-1.5 text-sm text-[#9CA3AF]">
                  <Video className="w-4 h-4 text-[#00E676]" />
                  Videollamada — toda España
                </span>
                <span className="flex items-center gap-1.5 text-sm text-[#9CA3AF]">
                  <Clock className="w-4 h-4 text-[#00E676]" />
                  Lun–Vie 9:00–19:00
                </span>
              </div>
            </div>
          </div>

          {/* Cómo trabajo */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-8 mb-8">
            <h2 className="text-white font-bold text-xl mb-6">Cómo trabajo</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { paso: '01', titulo: 'Accedo a tus datos', desc: 'Con tu autorización, vía Datadis o tu factura, veo tu consumo y tus contratos reales.' },
                { paso: '02', titulo: 'Reviso y superviso', desc: 'Analizo potencia, tarifas y mercado. Y sigo vigilándolo durante todo el año, no solo al renovar.' },
                { paso: '03', titulo: 'Te aviso y tú decides', desc: 'Solo te aviso cuando merece la pena. A veces la mejor decisión es no cambiar nada.' },
              ].map((s) => (
                <div key={s.paso} className="flex flex-col gap-3">
                  <span className="text-[#00E676] font-black text-2xl">{s.paso}</span>
                  <h3 className="text-white font-semibold">{s.titulo}</h3>
                  <p className="text-[#9CA3AF] text-sm leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Transparencia económica */}
          <div className="bg-[#00E676]/5 border border-[#00E676]/20 rounded-2xl p-8 mb-8">
            <h2 className="text-white font-bold text-xl mb-4">Cómo cobro — sin letra pequeña</h2>
            <p className="text-[#9CA3AF] leading-relaxed mb-5">
              Prefiero decírtelo claro desde el principio:
            </p>
            <div className="space-y-3">
              {[
                'La primera revisión no tiene ningún coste ni compromiso.',
                'Cobro una comisión de la comercializadora solo cuando hay un cambio que te conviene.',
                'Esa comisión nunca la pagas tú, y mi forma de cobrar nunca condiciona lo que te recomiendo.',
                'Si tu contrato actual sigue siendo la mejor opción, te lo digo y no cambiamos nada.',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-[#00E676] shrink-0 mt-0.5" />
                  <p className="text-[#9CA3AF] text-sm">{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Zona de cobertura */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-8 mb-8">
            <h2 className="text-white font-bold text-xl mb-6">Zona de cobertura</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-[#00E676]" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Presencial</h3>
                  <p className="text-[#9CA3AF] text-sm">País Vasco, alrededores bajo consulta.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center shrink-0">
                  <Video className="w-5 h-5 text-[#00E676]" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Videollamada</h3>
                  <p className="text-[#9CA3AF] text-sm">Toda España. Google Meet o Zoom. Normalmente en 24–48h.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Reseñas */}
          <div className="mb-10">
            <h2 className="text-white font-bold text-xl mb-6">Lo que dicen los clientes</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {reseñas.map((r) => (
                <div key={r.nombre} className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-5">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: r.estrellas }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-[#9CA3AF] text-sm leading-relaxed mb-4">"{r.texto}"</p>
                  <div>
                    <p className="text-white text-sm font-semibold">{r.nombre}</p>
                    <p className="text-[#6B7280] text-xs">{r.lugar}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4">
            <a href={WHATSAPP_ASESOR} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button size="xl" className="w-full gap-2 glow-green">
                <MessageCircle className="w-5 h-5" />
                Hablamos por WhatsApp
              </Button>
            </a>
            <Link href="/comparador" className="flex-1">
              <Button variant="secondary" size="xl" className="w-full gap-2">
                Sube tu factura
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
          <p className="text-[#4B5563] text-xs text-center mt-4">Respondo en menos de 24h en días laborables.</p>

        </div>
      </main>
      <Footer />
    </>
  )
}
