// Registra en accesos_plataforma que Claude ha entrado en una plataforma
// externa (Próxima, TotalEnergies, WolfCRM AE2000...) en nombre de Jonathan.
// Uso: node scripts/log-acceso.js "Próxima" "revisé prefacturas de septiembre"
//
// Lee .env.local a mano (sin dotenv, no está instalado) y usa la service
// role key — mismo patrón que los scripts de diagnóstico ad-hoc del repo.
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

function leerEnvLocal() {
  const env = {}
  const contenido = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  for (const linea of contenido.split(/\r?\n/)) {
    const m = linea.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
  return env
}

async function main() {
  const [, , plataforma, nota] = process.argv
  if (!plataforma) {
    console.error('Uso: node scripts/log-acceso.js "<plataforma>" "<nota opcional>"')
    process.exit(1)
  }

  const env = leerEnvLocal()
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  })

  // El proyecto tiene más de una cuenta en auth.users (no solo Jonathan) —
  // hay que resolver la suya por email, nunca coger "la primera".
  const { data: usuarios, error: errorUsuarios } = await supabase.auth.admin.listUsers()
  const jonathan = usuarios?.users?.find(u => u.email === 'jonahrds@gmail.com')
  if (errorUsuarios || !jonathan) {
    console.error('No se pudo resolver el usuario de Jonathan:', errorUsuarios?.message)
    process.exit(1)
  }
  const userId = jonathan.id

  const { error } = await supabase.from('accesos_plataforma').insert({
    user_id: userId,
    plataforma,
    actor: 'claude',
    origen: 'script',
    nota: nota || null,
  })

  if (error) {
    console.error('Error al registrar el acceso:', error.message)
    process.exit(1)
  }
  console.log(`Acceso registrado: ${plataforma}${nota ? ` — ${nota}` : ''}`)
}

main()
