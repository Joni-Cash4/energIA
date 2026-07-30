import { ImageResponse } from 'next/og'

// Imagen para compartir en WhatsApp / LinkedIn / X — generada en servidor.
// Next añade solo las etiquetas og:image y twitter:image en todas las páginas.

export const runtime = 'edge'
export const alt = 'IAenergía — Supervisión energética continua para empresas. Detectamos oportunidades de ahorro, errores de facturación y riesgos durante todo el año.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          backgroundColor: '#0A0A0A',
          backgroundImage: 'radial-gradient(circle at 85% 15%, rgba(0,230,118,0.18) 0%, transparent 45%), radial-gradient(circle at 10% 90%, rgba(21,101,192,0.15) 0%, transparent 45%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 48 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: '#00E676',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
            }}
          >
            ⚡
          </div>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, color: 'white' }}>
            IAenergía
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', color: 'white', fontSize: 62, fontWeight: 700, lineHeight: 1.18 }}>
          <span>Tu energía debería trabajar</span>
          <span>para tu empresa.</span>
          <span style={{ color: '#00E676' }}>Nosotros nos ocupamos.</span>
        </div>

        <div style={{ display: 'flex', marginTop: 44, fontSize: 30, color: '#9CA3AF' }}>
          Supervisión energética continua para empresas
        </div>

        <div style={{ display: 'flex', marginTop: 56, fontSize: 26, color: '#00E676' }}>
          www.iaenergia.es
        </div>
      </div>
    ),
    size
  )
}
