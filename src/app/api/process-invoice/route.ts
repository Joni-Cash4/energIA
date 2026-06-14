import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export async function POST(req: NextRequest) {
  // 1. Try the Python backend first
  try {
    const form = await req.formData()
    const res = await fetch(`${BACKEND_URL}/api/process-invoice`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30000),
    })
    if (res.ok) {
      return NextResponse.json(await res.json())
    }
  } catch {
    // backend not available — fall through to demo mode
  }

  // 2. Backend unavailable: return demo data so the UI is testable
  // In production, the Python backend handles real PDF parsing.
  const demo = {
    cups: 'ES0021000068456812R',
    comercializadora: 'Endesa Clientes',
    tarifa: '2.0TD',
    fecha_inicio: '2025-05-01',
    fecha_fin: '2025-05-31',
    total_factura: 118.43,
    kwh_total: 312,
    potencia_contratada: 3.3,
    ahorro_estimado_anual: 298.4,
    ahorro_estimado_mensual: 24.87,
    porcentaje_ahorro: 21,
    kwh_anuales_sips: 3744,
    coste_actual_energia: 74.2,
    coste_nuevo_energia: 52.1,
    coste_actual_potencia: 22.3,
    coste_nuevo_potencia: 20.8,
    periodos: [
      {
        periodo: 'P1',
        kwh: 87,
        precio_kwh: 0.1512,
        importe: 31.2,
        kwh_nuevo: 87,
        precio_kwh_nuevo: 0.1124,
        importe_nuevo: 24.8,
      },
      {
        periodo: 'P2',
        kwh: 142,
        precio_kwh: 0.1103,
        importe: 28.4,
        kwh_nuevo: 142,
        precio_kwh_nuevo: 0.0831,
        importe_nuevo: 19.4,
      },
      {
        periodo: 'P3',
        kwh: 83,
        precio_kwh: 0.0712,
        importe: 14.6,
        kwh_nuevo: 83,
        precio_kwh_nuevo: 0.0569,
        importe_nuevo: 9.0,
      },
    ],
    _demo: true,
  }

  return NextResponse.json(demo)
}
