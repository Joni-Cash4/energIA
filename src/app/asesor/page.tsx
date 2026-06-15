import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { MapPin, Clock, Phone, Video, Star, ArrowRight, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Tu asesor energético — IAenergía',
  description: 'Asesor independiente especializado en energía. Análisis personalizado de tu factura, sin comisiones ocultas.',
}

const reseñas = [
  { nombre: 'Carlos M.', lugar: 'Bilbao', texto: 'Cambié de Endesa a tarifa indexada y ahorro 47€/mes. Jonatan me lo explicó todo sin prisa.', estrellas: 5 },
  { nombre: 'Ana P.', lugar: 'Getxo', texto: 'Lo que más me gustó es que no intentó venderme nada. Analizó mi factura y me dijo exactamente qué hacer.', estrellas: 5 },
  { nombre: 'Roberto F.', lugar: 'Vitoria', texto: 'Videollamada muy clara. En 20 minutos entendí mi factura por primera vez en años.', estrellas: 5 },
]

export default function AsesorPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-16 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto py-14">

          {/* Hero asesor */}
          <div className="flex flex-col md:flex-row items-center gap-10 mb-16">
            {/* Foto placeholder */}
            <div className="shrink-0">
              <div className="w-44 h-44 rounded-3xl bg-[#141414] border-2 border-[#00E676]/30 flex items-center justify-center text-6xl">
                👤
              </div>
            </div>
            <div>
              <p className="text-[#00E676] text-sm uppercase tracking-widest mb-2">Tu asesor energético</p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Jonatan</h1>
              <p className="text-[#9CA3AF] text-lg mb-4 leading-relaxed">
                Asesor energético independiente. No trabajo para ninguna comercializadora — trabajo para ti.
                Mi objetivo es que pagues solo lo que debes pagar.
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
                { paso: '01', titulo: 'Analizas tu factura', desc: 'Subes el PDF. La IA extrae todos los datos en segundos.' },
                { paso: '02', titulo: 'Recibo tu caso', desc: 'Me llega tu análisis. Estudio tu perfil de consumo.' },
                { paso: '03', titulo: 'Te llamo yo', desc: 'Te explico el resultado y qué hacer. Sin tecnicismos.' },
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
            <h2 className="text-white font-bold text-xl mb-4">Cómo gano dinero — sin letra pequeña</h2>
            <p className="text-[#9CA3AF] leading-relaxed mb-5">
              Muchos comparadores no te dicen de dónde vienen sus ingresos. Yo sí:
            </p>
            <div className="space-y-3">
              {[
                'Cobro una pequeña comisión a la comercializadora cuando cambias de tarifa.',
                'Esa comisión nunca la pagas tú — la absorbe la comercializadora.',
                'Tu precio final es exactamente el que te presento en el informe. Sin sorpresas.',
                'Si no hay ahorro real para ti, te lo digo y no te recomiendo cambiar.',
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
                  <p className="text-[#9CA3AF] text-sm">Bilbao y área metropolitana, resto de País Vasco bajo consulta.</p>
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
            <div className="grid sm:grid-cols-3 gap-4">
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
            <Link href="/comparador" className="flex-1">
              <Button size="xl" className="w-full gap-2 glow-green">
                Analiza tu factura gratis
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href="https://wa.me/34600000000" target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button variant="secondary" size="xl" className="w-full gap-2">
                <Phone className="w-5 h-5" />
                WhatsApp directo
              </Button>
            </a>
          </div>
          <p className="text-[#4B5563] text-xs text-center mt-4">Respondo en menos de 24h en días laborables.</p>

        </div>
      </main>
      <Footer />
    </>
  )
}
