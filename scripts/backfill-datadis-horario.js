// Backfill de la curva HORARIA de consumo desde Datadis.
//
// El cron (api/cron/datadis-sync) solo sincroniza el mes en curso, y api/datadis/sync
// pedía 13 meses pero se quedaba con el kwh_total y tiraba la curva. Datadis guarda
// 2 años: esto los recupera mes a mes, deja el JSON crudo en el bucket `datadis-raw`
// y vuelca las horas en `consumos_datadis_horario`.
//
// Uso:
//   node scripts/backfill-datadis-horario.js --cups=ES0021000009822029MZ [--meses=24] [--dry]
//   node scripts/backfill-datadis-horario.js --todos [--meses=24] [--dry]
//   node scripts/backfill-datadis-horario.js --desde-bucket          (no toca Datadis)
//
// OJO: Datadis solo admite una consulta por CUPS+mes cada 24h. Los meses ya
// presentes en el bucket se saltan solos; --forzar los vuelve a pedir y quema cupo.
//
// Lee .env.local a mano (sin dotenv, no está instalado) y usa la service role key
// — mismo patrón que scripts/log-acceso.js.
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const DATADIS = 'https://datadis.es'
const BUCKET = 'datadis-raw'
const sleep = ms => new Promise(r => setTimeout(r, ms))

function leerEnvLocal() {
  const env = {}
  const contenido = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  for (const linea of contenido.split(/\r?\n/)) {
    const m = linea.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
  return env
}

function arg(nombre, porDefecto = null) {
  const found = process.argv.find(a => a.startsWith(`--${nombre}=`))
  if (found) return found.split('=').slice(1).join('=')
  return process.argv.includes(`--${nombre}`) ? true : porDefecto
}

// Datadis devuelve time como "01:00".."24:00": la etiqueta es el FIN del intervalo,
// así que "01:00" es la hora 0 (00:00-01:00) y "24:00" es la hora 23. Sin este -1
// la curva entera queda desplazada una hora y el reparto por periodo tarifario sale
// mal justo en los bordes (07->08 valle/llano y 21->22 punta/llano).
function horaDatadisAIndice(time) {
  const hh = parseInt(String(time).split(':')[0], 10)
  if (!Number.isFinite(hh)) return null
  if (hh >= 1 && hh <= 24) return hh - 1
  if (hh === 0) return 0            // por si alguna distribuidora usa 0..23
  return null
}

function mesesHaciaAtras(n) {
  const out = []
  const hoy = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    out.push(`${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

async function login(env) {
  const res = await fetch(`${DATADIS}/nikola-auth/tokens/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: env.DATADIS_USERNAME, password: env.DATADIS_PASSWORD }),
  })
  if (!res.ok) throw new Error(`Login Datadis ${res.status}`)
  const token = (await res.text()).replace(/"/g, '')
  if (!token) throw new Error('Datadis devolvió un token vacío')
  return { authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }
}

// Un mismo CUPS puede estar duplicado en `clientes` (una fila cargada desde factura
// sin NIF y otra con el NIF y la autorización). Para Datadis hace falta la que tiene
// NIF: quedarse con "la primera" trae la fila incompleta y get-supplies-v2 falla.
function eligeFilaCliente(filas) {
  return filas.find(c => c.autorizacion_datadis && c.nif)
      ?? filas.find(c => c.nif)
      ?? filas[0]
}

async function buscaSuministro(headers, cups, nif, usuarioDatadis) {
  const propio = !nif || nif === usuarioDatadis
  const url = propio
    ? `${DATADIS}/api-private/api/get-supplies`
    : `${DATADIS}/api-private/api/get-supplies-v2?authorizedNif=${encodeURIComponent(nif)}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`get-supplies ${res.status}`)
  const cuerpo = await res.json()
  const lista = Array.isArray(cuerpo) ? cuerpo : (cuerpo.supplies ?? cuerpo.response ?? [])
  return lista.find(s => String(s.cups).trim() === cups.trim()) ?? null
}

async function procesaCups(sb, headers, env, cliente, meses, dry, guardarHoras, forzar) {
  const { id: clienteId, cups, nif } = cliente
  console.log(`
=== ${cups} (${cliente.nombre || 's/n'}) ===`)

  // La curva se guarda por CUPS (ADR-0001), no por titular. El bucket sí se organiza
  // por cliente porque así lo creó el cron y no se cambia su estructura aquí.
  const { data: filaCups } = await sb.from('cups').select('id').eq('codigo', cups).maybeSingle()
  if (!filaCups && guardarHoras) {
    console.log('  !! ese CUPS no está en la tabla `cups`: no se pueden guardar horas')
  }
  const cupsId = filaCups?.id ?? null

  const supply = await buscaSuministro(headers, cups, nif, env.DATADIS_USERNAME)
  if (!supply) {
    console.log('  !! CUPS no encontrado en Datadis (¿autorización caducada?)')
    return { cups, meses: 0, horas: 0, error: 'no encontrado' }
  }
  console.log(`  distribuidora=${supply.distributorCode} pointType=${supply.pointType}`)

  // get-consumption-data acepta RANGO y devuelve la curva horaria completa del
  // rango entero, no un agregado mensual: verificado 2026-09-09 con 2024/10-2024/12
  // -> 2208 elementos (92 días × 24h) y suma exacta contra los meses ya guardados.
  // Por eso se pide UNA sola llamada, no una por mes. El convenio Datadis (cláusula
  // 2.2.2) ampara descargar y volcar en sistemas propios, así que lo capturado no
  // se vuelve a pedir nunca: lo que ya está en el bucket se descuenta del rango.
  const { data: yaEnBucket } = await sb.storage.from(BUCKET).list(`${clienteId}/${cups}`)
  const capturados = new Set((yaEnBucket ?? []).map(f => f.name.replace('.json', '')))

  const pedidos = mesesHaciaAtras(meses)
  const faltantes = forzar ? pedidos : pedidos.filter(m => !capturados.has(m.replace('/', '-')))
  if (capturados.size) console.log(`  ya en bucket: ${capturados.size} meses`)
  if (faltantes.length === 0) {
    console.log('  nada que pedir')
    return { cups, meses: 0, horas: 0, saltados: pedidos.length }
  }

  // Un único rango que cubra los que faltan. Si están salteados se piden también
  // los intermedios: sale más barato en llamadas que trocear, y ya los teníamos.
  const orden = [...faltantes].sort()
  const desde = orden[0], hasta = orden[orden.length - 1]
  console.log(`  faltan ${faltantes.length} meses -> 1 petición ${desde} a ${hasta}`)
  if (dry) return { cups, meses: 0, horas: 0, saltados: pedidos.length - faltantes.length }

  await sleep(3000)
  const q = new URLSearchParams({
    cups, distributorCode: String(supply.distributorCode),
    startDate: desde, endDate: hasta,
    measurementType: '0', pointType: String(supply.pointType),
  })
  // Sin authorizedNif, Datadis devuelve 200 con array VACÍO para suministros de
  // tercero — no un error. Es la razón de que el cron no trajera nunca nada de
  // los CUPS delegados: parecía "sin lecturas" cuando en realidad faltaba el NIF.
  if (nif && nif !== env.DATADIS_USERNAME) q.set('authorizedNif', nif)

  const res = await fetch(`${DATADIS}/api-private/api/get-consumption-data?${q}`, { headers })
  if (!res.ok) { console.log(`  HTTP ${res.status}`); return { cups, meses: 0, horas: 0, error: `HTTP ${res.status}` } }

  // Datadis responde en TEXTO PLANO (no JSON) para avisos como "Consulta ya
  // realizada en las últimas 24 horas" — el bloqueo es por consulta idéntica
  // (mismo CUPS y mismo rango), no por mes. Un .json() a ciegas revienta.
  const crudo = await res.text()
  let lecturas
  try { lecturas = JSON.parse(crudo) }
  catch { console.log(`  Datadis dice "${crudo.trim().slice(0, 100)}"`); return { cups, meses: 0, horas: 0, error: 'aviso Datadis' } }
  if (!Array.isArray(lecturas) || lecturas.length === 0) {
    console.log('  sin lecturas'); return { cups, meses: 0, horas: 0, error: 'sin lecturas' }
  }
  console.log(`  ${lecturas.length} lecturas recibidas`)

  // Se reparte por mes para mantener un fichero por mes en el bucket, que es lo que
  // el cron ya genera y lo que usa el guard de "ya capturado".
  const porMes = new Map()
  for (const r of lecturas) {
    const ym = String(r.date || '').slice(0, 7).replace('/', '-')
    if (ym.length !== 7) continue
    if (!porMes.has(ym)) porMes.set(ym, [])
    porMes.get(ym).push(r)
  }

  let totalMeses = 0, totalHoras = 0
  for (const [yearMonth, delMes] of [...porMes.entries()].sort()) {
    const kwhTotal = Math.round(delMes.reduce((s, r) => s + Number(r.consumptionKWh || 0), 0) * 1000) / 1000

    // Agregado por (fecha, hora) sumando, no pisando. OJO: los días de cambio de
    // hora Datadis NO devuelve 23/25 lecturas — normaliza a 24 etiquetas y descarta.
    // Verificado: 2026/03/29 (adelanto) trae 23 lecturas y la que falta es "02:00",
    // no "03:00"; 2025/10/26 (atraso) trae 24 sin ninguna etiqueta repetida.
    // La suma es defensiva por si alguna distribuidora sí repite etiqueta.
    const porHora = new Map()
    for (const r of delMes) {
      const hora = horaDatadisAIndice(r.time)
      const fecha = String(r.date || '').replace(/\//g, '-')
      if (hora === null || fecha.length !== 10) continue
      const k = `${fecha}|${hora}`
      porHora.set(k, (porHora.get(k) || 0) + Number(r.consumptionKWh || 0))
    }
    const filas = [...porHora.entries()].map(([k, kwh]) => {
      const [fecha, hora] = k.split('|')
      return { cups_id: cupsId, fecha, hora: Number(hora), kwh: Math.round(kwh * 1000) / 1000 }
    })

    const blob = new Blob([JSON.stringify({
      synced_at: new Date().toISOString(), cups, year_month: yearMonth,
      distributor_code: supply.distributorCode, point_type: supply.pointType,
      kwh_total: kwhTotal, readings: delMes,
    })], { type: 'application/json' })
    const { error: errStorage } = await sb.storage
      .from(BUCKET).upload(`${clienteId}/${cups}/${yearMonth}.json`, blob, { upsert: true })

    const { error: errHoras } = (guardarHoras && cupsId)
      ? await sb.from('consumos_datadis_horario')
          .upsert(filas, { onConflict: 'cups_id,fecha,hora' })
      : { error: null }

    await sb.from('consumos_datadis').upsert(
      [{ cliente_id: clienteId, cups, year_month: yearMonth, kwh_total: kwhTotal,
         fecha_consulta: new Date().toISOString() }],
      { onConflict: 'cliente_id,cups,year_month' },
    )

    console.log(`  ${yearMonth}: ${filas.length} horas, ${kwhTotal} kWh` +
      `${errStorage ? ` | STORAGE FALLÓ: ${errStorage.message}` : ''}` +
      `${errHoras ? ` | HORAS FALLÓ: ${errHoras.message}` : ''}`)
    if (!errStorage) { totalMeses++; totalHoras += filas.length }
  }
  return { cups, meses: totalMeses, horas: totalHoras, saltados: pedidos.length - faltantes.length }
}

async function cargaDesdeBucket(sb) {
  const { data: nivel1, error } = await sb.storage.from(BUCKET).list('')
  if (error) throw new Error(`No se pudo listar ${BUCKET}: ${error.message}`)

  let ficheros = 0, horas = 0
  for (const cliente of nivel1 ?? []) {
    const { data: nivel2 } = await sb.storage.from(BUCKET).list(cliente.name)
    for (const cups of nivel2 ?? []) {
      // La tabla va por CUPS (ADR-0001): se resuelve una vez por carpeta, no por fichero.
      const { data: filaCups } = await sb.from('cups').select('id').eq('codigo', cups.name).maybeSingle()
      if (!filaCups) { console.log(`  ${cups.name}: no está en la tabla \`cups\`, se salta`); continue }

      const { data: nivel3 } = await sb.storage.from(BUCKET).list(`${cliente.name}/${cups.name}`)
      for (const f of (nivel3 ?? []).filter(x => x.name.endsWith('.json'))) {
        const ruta = `${cliente.name}/${cups.name}/${f.name}`
        const { data: blob, error: errBajada } = await sb.storage.from(BUCKET).download(ruta)
        if (errBajada) { console.log(`  ${ruta}: ${errBajada.message}`); continue }

        const json = JSON.parse(await blob.text())
        // Mismo criterio de agregación que procesaCups (ver nota sobre cambio de hora).
        const porHora = new Map()
        for (const r of json.readings ?? []) {
          const hora = horaDatadisAIndice(r.time)
          const fecha = String(r.date || '').replace(/\//g, '-')
          if (hora === null || fecha.length !== 10) continue
          const k = `${fecha}|${hora}`
          porHora.set(k, (porHora.get(k) || 0) + Number(r.consumptionKWh || 0))
        }
        const filas = [...porHora.entries()].map(([k, kwh]) => {
          const [fecha, hora] = k.split('|')
          return { cups_id: filaCups.id, fecha, hora: Number(hora), kwh: Math.round(kwh * 1000) / 1000 }
        })
        const { error: errUpsert } = await sb.from('consumos_datadis_horario')
          .upsert(filas, { onConflict: 'cups_id,fecha,hora' })
        console.log(`  ${ruta}: ${filas.length} horas${errUpsert ? ` | FALLÓ: ${errUpsert.message}` : ''}`)
        if (!errUpsert) { ficheros++; horas += filas.length }
      }
    }
  }
  console.log(`\n===== ${ficheros} ficheros cargados, ${horas} horas =====`)
}

async function main() {
  const env = leerEnvLocal()
  if (!env.DATADIS_USERNAME || !env.DATADIS_PASSWORD) {
    console.error('Faltan DATADIS_USERNAME / DATADIS_PASSWORD en .env.local'); process.exit(1)
  }
  const meses = Number(arg('meses', 24))
  const dry = Boolean(arg('dry', false))
  const cupsArg = arg('cups')
  const todos = Boolean(arg('todos', false))
  const desdeBucket = Boolean(arg('desde-bucket', false))
  const forzar = Boolean(arg('forzar', false))
  if (!cupsArg && !todos && !desdeBucket) {
    console.error('Uso: --cups=ES00... | --todos | --desde-bucket   [--meses=24] [--dry]')
    process.exit(1)
  }

  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false } })

  if (desdeBucket) { await cargaDesdeBucket(sb); return }

  // Si la tabla horaria aún no está creada NO se aborta: Datadis solo deja pedir
  // cada CUPS+mes una vez cada 24h, así que lo prioritario es capturar el JSON
  // crudo en el bucket. Las horas se cargan luego desde ahí, sin volver a Datadis.
  let guardarHoras = true
  if (!dry) {
    const { error } = await sb.from('consumos_datadis_horario').select('cups_id').limit(1)
    if (error) {
      guardarHoras = false
      console.warn('\n!! consumos_datadis_horario no existe todavía — se guardará SOLO el JSON')
      console.warn('!! crudo en el bucket. Ejecuta supabase/migrations/consumos_datadis_horario.sql')
      console.warn('!! y luego carga las horas con --desde-bucket (sin gastar consultas Datadis).\n')
    }
  }

  let q = sb.from('clientes').select('id,nombre,cups,nif,autorizacion_datadis')
  q = cupsArg ? q.eq('cups', cupsArg) : q.not('autorizacion_datadis', 'is', null)
  const { data: filas, error } = await q
  if (error) { console.error('Error leyendo clientes:', error.message); process.exit(1) }
  if (!filas?.length) { console.error('Sin clientes que casen'); process.exit(1) }

  const porCups = new Map()
  for (const f of filas) {
    if (!porCups.has(f.cups)) porCups.set(f.cups, [])
    porCups.get(f.cups).push(f)
  }
  const objetivos = [...porCups.values()].map(eligeFilaCliente)
  console.log(`CUPS a procesar: ${objetivos.length} | meses: ${meses}${dry ? ' | DRY RUN' : ''}`)

  const headers = await login(env)
  const resumen = []
  for (const cliente of objetivos) {
    try { resumen.push(await procesaCups(sb, headers, env, cliente, meses, dry, guardarHoras, forzar)) }
    catch (e) { console.log(`  !! ${cliente.cups}: ${e.message}`); resumen.push({ cups: cliente.cups, error: e.message }) }
    await sleep(10000)
  }

  console.log('\n===== RESUMEN =====')
  for (const r of resumen) console.log(`  ${r.cups}: ${r.meses ?? 0} meses nuevos, ${r.horas ?? 0} horas` +
    `${r.saltados ? `, ${r.saltados} ya estaban` : ''}${r.error ? ` (${r.error})` : ''}`)
}

main()
