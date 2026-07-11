import { BoletinView } from '@/components/boletin/BoletinView'

// Muestra siempre la última semana completa; cada semana tiene además su
// propia URL indexable en /noticias/boletin/[semana].

export default function BoletinPage() {
  return <BoletinView />
}
