import { AsesorFotoCropper } from '@/components/dashboard/AsesorFotoCropper'
import { getAsesorFotoUrl } from '@/lib/asesor-foto'

export default async function AsesorFotoPage() {
  const currentUrl = await getAsesorFotoUrl()
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Foto del asesor</h1>
      <p className="text-[#9CA3AF] text-sm mb-8">
        Se muestra en la página pública /asesor. Los cambios se ven al momento, sin necesidad de desplegar nada.
      </p>
      <AsesorFotoCropper currentUrl={currentUrl} />
    </div>
  )
}
