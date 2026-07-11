'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, RefreshCw, BarChart2, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Toaster } from '@/components/ui/toaster'
import { Button } from '@/components/ui/button'
import { getNews } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { NewsItem } from '@/types'

function SkeletonCard({ wide }: { wide?: boolean }) {
  return (
    <div className={`bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden animate-pulse ${wide ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
      <div className={`bg-[#1F1F1F] ${wide ? 'h-56' : 'h-44'}`} />
      <div className="p-5 space-y-3">
        <div className="h-3 bg-[#1F1F1F] rounded w-1/4" />
        <div className="h-4 bg-[#1F1F1F] rounded w-full" />
        <div className="h-4 bg-[#1F1F1F] rounded w-3/4" />
        <div className="h-3 bg-[#1F1F1F] rounded w-1/2" />
      </div>
    </div>
  )
}

function HeroCard({ item }: { item: NewsItem }) {
  return (
    <motion.a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group sm:col-span-2 lg:col-span-3 relative overflow-hidden bg-[#141414] border border-[#1F1F1F] rounded-2xl hover:border-[#00E676]/30 transition-colors flex flex-col sm:flex-row"
    >
      {/* Image */}
      <div className="relative sm:w-72 lg:w-96 h-52 sm:h-auto shrink-0 bg-[#1A1A1A]">
        {item.imagen ? (
          <Image
            src={item.imagen}
            alt={item.titulo}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl">⚡</span>
          </div>
        )}
        <span className="absolute top-3 left-3 px-2.5 py-1 bg-[#00E676] text-black rounded-full text-xs font-bold">
          DESTACADO
        </span>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col justify-center flex-1">
        <div className="flex items-center gap-3 mb-3">
          <span className="px-2.5 py-1 bg-black/40 rounded-full text-xs text-white font-medium">{item.fuente}</span>
          <span className="text-[#6B7280] text-xs">{formatDate(item.fecha)}</span>
        </div>
        <h2 className="text-white font-bold text-xl sm:text-2xl leading-snug mb-3 group-hover:text-[#00E676] transition-colors line-clamp-3">
          {item.titulo}
        </h2>
        {item.descripcion && (
          <p className="text-[#9CA3AF] text-sm line-clamp-3 mb-4">{item.descripcion}</p>
        )}
        <div className="flex items-center gap-1.5 text-[#00E676] text-sm font-medium">
          Leer artículo <ExternalLink className="w-3.5 h-3.5" />
        </div>
      </div>
    </motion.a>
  )
}

export default function NoticiasPage() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  const load = async () => {
    setLoading(true)
    try {
      const data = await getNews()
      setNews(data.noticias ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const sources = ['all', ...Array.from(new Set(news.map((n) => n.fuente)))]
  const filtered = filter === 'all' ? news : news.filter((n) => n.fuente === filter)
  const [hero, ...rest] = filtered

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-16 pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto py-10">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10"
          >
            <div>
              <p className="text-[#00E676] text-sm uppercase tracking-widest mb-1">Sector energético</p>
              <h1 className="text-3xl font-bold text-white">Últimas noticias</h1>
            </div>
            <Button variant="secondary" size="sm" onClick={load} disabled={loading} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </motion.div>

          {/* Boletín semanal — contenido propio, siempre visible */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-8">
            <Link
              href="/noticias/boletin"
              className="group flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-gradient-to-r from-[#00E676]/10 to-transparent border border-[#00E676]/30 rounded-2xl p-5 hover:border-[#00E676]/60 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-[#00E676]/15 flex items-center justify-center shrink-0">
                <BarChart2 className="w-5 h-5 text-[#00E676]" />
              </div>
              <div className="flex-1">
                <p className="text-[#00E676] text-xs uppercase tracking-widest mb-0.5">Boletín IAenergía · cada semana</p>
                <h2 className="text-white font-bold text-lg leading-snug">El mercado eléctrico, esta semana: precios, demanda y mix de generación</h2>
                <p className="text-[#9CA3AF] text-sm mt-1">Análisis semanal con datos públicos de Red Eléctrica. Redacción propia, sin letra pequeña.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[#00E676] text-sm font-medium whitespace-nowrap">
                Leer boletín <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          </motion.div>

          {/* Filters */}
          {!loading && sources.length > 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2 mb-8">
              {sources.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                    filter === s
                      ? 'bg-[#00E676] text-black font-medium'
                      : 'bg-[#141414] border border-[#1F1F1F] text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  {s === 'all' ? 'Todas las fuentes' : s}
                </button>
              ))}
            </motion.div>
          )}

          {/* Grid */}
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <SkeletonCard wide />
              {[1,2,3,4,5].map((n) => <SkeletonCard key={n} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-[#6B7280]">No hay noticias disponibles en este momento.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Hero destacado */}
              {hero && <HeroCard item={hero} />}

              {/* Rest */}
              {rest.map((item, i) => (
                <motion.a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (i + 1) * 0.05 }}
                  className="group bg-[#141414] border border-[#1F1F1F] rounded-2xl overflow-hidden hover:border-[#00E676]/30 transition-colors flex flex-col"
                >
                  <div className="relative h-44 bg-[#1A1A1A] overflow-hidden">
                    {item.imagen ? (
                      <Image src={item.imagen} alt={item.titulo} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[#00E676] text-2xl">⚡</span>
                      </div>
                    )}
                    <span className="absolute top-3 left-3 px-2.5 py-1 bg-black/70 backdrop-blur-sm rounded-full text-xs text-white font-medium">
                      {item.fuente}
                    </span>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <p className="text-xs text-[#6B7280] mb-2">{formatDate(item.fecha)}</p>
                    <h3 className="text-white font-semibold leading-snug mb-3 line-clamp-3 group-hover:text-[#00E676] transition-colors flex-1">
                      {item.titulo}
                    </h3>
                    {item.descripcion && (
                      <p className="text-[#9CA3AF] text-sm line-clamp-2 mb-4">{item.descripcion}</p>
                    )}
                    <div className="flex items-center gap-1 text-[#00E676] text-sm font-medium mt-auto">
                      Leer artículo <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </motion.a>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
      <Toaster />
    </>
  )
}
