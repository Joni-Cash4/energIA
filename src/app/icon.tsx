import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: '#111111',
          borderRadius: 96,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 700,
            fontSize: 220,
            color: '#00E676',
            lineHeight: 1,
            marginBottom: 4,
          }}
        >
          IA
        </span>
        <span
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 500,
            fontSize: 72,
            color: '#ffffff',
            letterSpacing: 8,
            lineHeight: 1,
          }}
        >
          Energía
        </span>
      </div>
    ),
    { ...size }
  )
}
