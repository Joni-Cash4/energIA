import { NextRequest, NextResponse } from 'next/server'
import { buildBoletin } from '@/lib/boletin'

// Boletín semanal del mercado — la lógica vive en @/lib/boletin (compartida
// con el cron de envío por email). Sin mock: si REE falla, 503.

export const revalidate = 3600

export async function GET(req: NextRequest) {
  try {
    const data = await buildBoletin(req.nextUrl.searchParams.get('start'))
    return NextResponse.json(data)
  } catch (err) {
    console.error('[boletin]', err)
    return NextResponse.json({ error: 'No se pudieron obtener los datos de REE' }, { status: 503 })
  }
}
