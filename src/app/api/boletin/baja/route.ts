import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Baja del boletín vía enlace del email (token único por suscriptor).
// Devuelve una página HTML mínima — se abre directamente desde el correo.

function pagina(titulo: string, cuerpo: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <meta name="robots" content="noindex"><title>${titulo} — IAenergía</title></head>
     <body style="font-family:sans-serif;background:#0A0A0A;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
       <div style="text-align:center;padding:32px;max-width:420px">
         <p style="font-size:40px;margin:0 0 16px">⚡</p>
         <h1 style="font-size:22px;margin:0 0 12px">${titulo}</h1>
         <p style="color:#9CA3AF;font-size:15px;line-height:1.5">${cuerpo}</p>
         <p style="margin-top:24px"><a href="https://www.iaenergia.es" style="color:#00E676">iaenergia.es</a></p>
       </div>
     </body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? ''
  if (!/^[0-9a-f-]{36}$/.test(token)) {
    return pagina('Enlace no válido', 'El enlace de baja está incompleto. Usa el enlace del último correo que recibiste.')
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data, error } = await supabase
      .from('boletin_suscriptores')
      .update({ activo: false, fecha_baja: new Date().toISOString() })
      .eq('token', token)
      .select('email')
    if (error) throw error
    if (!data?.length) {
      return pagina('Enlace no válido', 'No encontramos ninguna suscripción asociada a este enlace.')
    }
    return pagina('Baja completada', 'Ya no recibirás el boletín semanal. Puedes volver a suscribirte cuando quieras desde iaenergia.es/noticias/boletin.')
  } catch (e) {
    console.error('[baja]', e)
    return pagina('Algo ha fallado', 'No hemos podido procesar la baja. Inténtalo de nuevo en unos minutos.')
  }
}
