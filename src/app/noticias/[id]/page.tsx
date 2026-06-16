import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { getNoticiaPropia, NOTICIAS_PROPIAS } from '@/lib/noticias-propias'
import { formatDate } from '@/lib/utils'

export function generateStaticParams() {
  return NOTICIAS_PROPIAS.map((n) => ({ id: n.id }))
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const noticia = getNoticiaPropia(params.id)
  if (!noticia) return { title: 'Noticia no encontrada — IAenergía' }
  return {
    title: `${noticia.titulo} — IAenergía`,
    description: noticia.descripcion,
  }
}

export default function NoticiaPage({ params }: { params: { id: string } }) {
  const noticia = getNoticiaPropia(params.id)
  if (!noticia) notFound()

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-16 pb-20 px-4 sm:px-6">
        <article className="max-w-2xl mx-auto py-10">
          <Link
            href="/noticias"
            className="inline-flex items-center gap-2 text-[#6B7280] hover:text-white text-sm mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a noticias
          </Link>

          <div className="relative h-56 sm:h-72 rounded-2xl overflow-hidden mb-8 bg-[#141414]">
            <Image src={noticia.imagen} alt={noticia.titulo} fill className="object-cover" unoptimized />
          </div>

          <div className="flex items-center gap-3 mb-4">
            <span className="px-2.5 py-1 bg-[#00E676]/10 text-[#00E676] rounded-full text-xs font-medium">
              {noticia.fuente}
            </span>
            <span className="text-[#6B7280] text-xs">{formatDate(noticia.fecha)}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-snug mb-8">
            {noticia.titulo}
          </h1>

          <div className="prose prose-invert max-w-none space-y-5 text-[#9CA3AF] leading-relaxed text-[15px]">
            {noticia.contenido.map((parrafo, i) => (
              <p key={i}>{parrafo}</p>
            ))}
          </div>

          <Link
            href={noticia.cta.href}
            className="mt-10 inline-flex items-center gap-2 px-5 py-3 bg-[#00E676] text-black rounded-xl font-medium hover:bg-[#00E676]/90 transition-colors"
          >
            {noticia.cta.label}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </article>
      </main>
      <Footer />
    </>
  )
}
