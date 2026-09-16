# IAenergía — Landing + Comparador (Next.js)

## Qué hace este proyecto
Web pública `iaenergia.es` para captación de clientes del asesor energético Jonathan,
más el panel interno (`/dashboard`) donde Jonathan gestiona clientes, contratos,
comisiones y comparativas.
Explica el servicio, muestra precios de mercado en tiempo real, y permite subir facturas
para obtener una comparativa real de ahorro vs tarifa indexada y tarifa fija.

**IMPORTANTE:** No somos comercializadora. No nombrar empresas públicamente.
Analizamos todas las compañías pero operamos con dos en concreto (no nombrar).
Mensaje: "Analizamos todas las compañías" + comparativa "Tu factura actual vs Tarifa Indexada vs Tarifa Fija".

**Los informes de ahorro son de uso interno** mientras el cálculo no esté validado al 100 %:
Jonathan decide si se enseñan al cliente.

## Stack
- **Next.js 16** (App Router, Turbopack) + **React 18** + **TypeScript** + **Tailwind CSS**
- **shadcn/ui** (Radix UI) + **Framer Motion** (animaciones)
- **Supabase** (auth + DB): `src/lib/supabase.ts` (cliente), `src/lib/supabase-server.ts` (service role, rutas API y crons)
- **Recharts** para gráficas de mercado
- **Anthropic Claude** (`claude-sonnet-4-6`) para extracción de facturas
- **Datos de mercado:**
  - Precios en tiempo real para la web pública (`/mercado`, landing, boletín): API pública de REE (`apidatos.ree.es`, sin token).
  - Cálculo de facturas: tablas de Supabase que rellenan crons de Vercel desde **ESIOS** (con `ESIOS_TOKEN`), ver abajo. OMIE en directo solo como red de seguridad.
- **Vercel Cron** (`vercel.json`) y **Telegram** (`src/lib/telegram.ts`) para avisos

## Estructura src/ (lo principal)
```
src/
├── app/
│   ├── page.tsx, layout.tsx, login/, mercado/, comparador/, asesor/
│   ├── dashboard/
│   │   ├── nueva-factura/page.tsx   # Upload factura + comparativa + validador + PDF
│   │   └── clientes/, contratos/, comisiones/, gestiones/, leads/, simulador/, …
│   └── api/
│       ├── market-hourly|market-prices|market-weekly/  # REE pública, web pública
│       ├── market-historical/route.ts  # PMD por periodo del rango exacto de una factura
│       ├── process-invoice/route.ts    # POST: extrae factura + sim_indexada + sim_fijas
│       ├── informe-hoy/route.ts        # GET: resumen diario BOE + ayudas Euskadi (repo privado GitHub)
│       ├── send-report/route.ts        # comparador público: guarda lead y envía email
│       ├── telegram/webhook/route.ts
│       └── cron/                       # ver "Crons de datos de mercado"
├── components/ (landing/, layout/, comparador/, mercado/)
├── lib/
│   ├── api.ts              # processInvoice(files, feeMwh)
│   ├── market-rates.ts     # tablas BOE 2026, valores de reserva de SC/CAP/PERD, Próxima
│   ├── market-real.ts      # getMercadoRealRango: SC/CAP/PERD de los días de la factura
│   ├── periodos.ts         # getPeriodo(): calendario P1-P6 (única fuente de verdad)
│   ├── tarifas-fijas.ts    # getProductosFijos: tarifas fijas vigentes (maestro en Supabase)
│   ├── validador-factura.ts
│   └── supabase.ts, supabase-server.ts, telegram.ts, …
└── types/index.ts          # SimTarifa, InvoiceAnalysis
```
Decisiones de arquitectura en `architecture/adr/` y principios en `architecture/product-principles.md`.

## Comandos
```powershell
cd C:\energIA
npm run dev       # Dev en http://localhost:3000
npm run build     # Build producción
npx tsc --noEmit  # Solo verificar tipos
```

## Variables de entorno (.env.local / Vercel)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SECRET_KEY=...          # service role (rutas API, crons, scripts locales;
                                 # supabase-server.ts usa antes SUPABASE_SERVICE_ROLE_KEY si existe)
NEXT_PUBLIC_SITE_URL=https://iaenergia.es
ANTHROPIC_API_KEY=...
ESIOS_TOKEN=...                  # crons de mercado (solo Vercel/servidor)
CRON_SECRET=...                  # autenticación de los crons
RESEND_API_KEY=...               # emails
TELEGRAM_BOT_TOKEN=... / TELEGRAM_ALLOWED_CHAT_ID=... / TELEGRAM_WEBHOOK_SECRET=...
DATADIS_USERNAME=... / DATADIS_PASSWORD=...
JONATHAN_USER_ID=...
GITHUB_INFORMES_TOKEN=...        # PAT fine-grained, solo lectura, repo Joni-Cash4/iaenergia-informes-boe
```
Nunca imprimir valores de claves; como mucho, comprobar que el nombre existe.

## Sección "El mercado, hoy" (`/mercado`, tab "informe")
Bloque diario con datos del repo privado `Joni-Cash4/iaenergia-informes-boe`
(`informes/hoy.json`, se regenera cada día laborable ~9:00 hora Madrid).
- `src/app/api/informe-hoy/route.ts`: fetch server-side a la Contents API de
  GitHub con `GITHUB_INFORMES_TOKEN` (nunca llega al cliente). Cualquier fallo
  (token ausente, repo sin datos, rate limit) responde `null` con status 200.
- `src/components/mercado/ElMercadoHoy.tsx`: cliente, hace fetch a
  `/api/informe-hoy`. Si `data` es `null`, muestra estado vacío discreto —
  nunca rompe la página.
- Tipos del contrato de datos en `src/types/index.ts` (`InformeHoy` y afines).

## API de mercado — REE pública
```
GET https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real
  ?time_trunc=hour
  &start_date=YYYY-MM-DDTHH:mm
  &end_date=YYYY-MM-DDTHH:mm
  &geo_trunc=electric_system
  &geo_limit=peninsular
  &geo_ids=8741
```
Devuelve `included[0].attributes.values[]` con `{value: number (€/MWh), datetime: string}`.
Confirmado funcionando desde Vercel.

## Crons de datos de mercado (ADR-0005, 0006, 0008, 0012)
Reglas de uso responsable de ESIOS (el token ya se bloqueó una vez): **una petición por
ejecución**, solo los días que falten hasta ayer, **como mucho 31 días**, solo días
completos y seguidos; si todo está al día, no se llama a ESIOS.
- `mercado-pmd-sync` (5:30 UTC) → `mercado_pmd_diario` (fecha, hora 0-23, precio_mwh).
  ESIOS indicador 600, **`geo_id 3` = España** (el 1 es Portugal). Histórico desde 2025-01-01.
- `mercado-sc-cap-perd-diario` (6:15 UTC) → `mercado_sc_cap_perd_diario` (fecha, sc, cap, perd).
  ESIOS archivo 70 (PVPCDATA): SC = SAHPCB+FOMPCB+FOSPCB+INTPCB+EDSRPCB, CAP = PCAPPCB
  (ambos /1000 → €/kWh), PERD = (1 + media COF2TD) × 1,04. Con varios días devuelve un ZIP;
  **con un solo día devuelve el JSON suelto**. Histórico desde 2025-01-01.
- `mercado-perd-sync` (día 2) → tablas mensuales `mercado_sc_cap` y `mercado_perd` (mes anterior).
- `mercado-vigilancia` (7:30 UTC) → no llama a ESIOS; si faltan días en esas tablas, avisa por Telegram.
- OMIE `MARGINALPDBC`: `Año;Mes;Día;Periodo;Precio Portugal;Precio España;` → **España es la
  columna 5** (índice 0). Probar versiones `.1`, `.2` y `.3`. Cuartos de hora desde oct-2025.

## Periodos tarifarios (src/lib/periodos.ts)
Fuente: CNMC Circular 3/2020 (BOE-A-2020-1066). Única fuente de verdad — usar `getPeriodo()`
(el sistema Python tiene un port 1:1 y coincide hora a hora).
- **3.0TD / 6.1TD Península:**
  - Valle 00-08h → P6 siempre; sábados, domingos y festivos nacionales → P6 todo el día.
  - Laborable 08-24h: punta (09-14h, 18-22h) / llano (08-09h, 14-18h, 22-24h):
    - Alta (ene, feb, jul, dic): punta=P1, llano=P2
    - Media-Alta (mar, nov): punta=P2, llano=P3
    - Media (jun, ago, sep): punta=P3, llano=P4
    - Baja (abr, may, oct): punta=P4, llano=P5
  - Canarias y Baleares tienen sus propias temporadas y horas de punta (`zona`).
- **2.0TD:** punta P1 10-14h y 18-22h; llano P2 8-10h, 14-18h y 22-24h; valle P3 0-8h y
  todo el día en sábados, domingos y festivos (art. 7.3). **La punta empieza a las 10h**, no a las 9h.

## Lógica de simulación (process-invoice + src/lib/market-rates.ts)
Motor portado desde el sistema Python local
(`C:\MonitorizacionEnergetica\sistema\core\motor_calculo.py` + `fuentes_mercado.py`).
Tablas BOE 2026 completas para 2.0TD/3.0TD/6.1TD: peajes/cargos de energía y potencia.

**La factura que entra NO se corrige: se compara tal cual.** Cada factura es un mundo (hay
comercializadoras que no cobran la potencia a precio BOE y meten su margen en ella, o dan
precios todo incluido). El coste actual es siempre el que pone la factura; los peajes y
cargos del BOE solo se usan para calcular **nuestros** precios (indexada y fijas). El
validador del dashboard compara las líneas de peajes/cargos con el BOE solo para avisar,
sin modificar nada. Si un parser separa componentes con el BOE, el total de cada periodo
debe seguir siendo el de la factura.

- **Fórmula de la indexada (Próxima Cristalina):**
  `precio_kWh = PEAJ_BOE + CARG_BOE + PERD × (PMD + SC + CAP) + fee`
  - **PMD:** precio de mercado **de los días exactos de la factura** (nunca el de hoy) vía
    `/api/market-historical`: lee `mercado_pmd_diario` (OMIE en directo solo para días que
    falten), agrupa por periodo con `getPeriodo()` y, si el CUPS tiene curva horaria Datadis
    con ≥95 % de cobertura, **pondera por el consumo real** (ADR-0010). Sin curva, media simple.
  - **SC, CAP y PERD:** `getMercadoRealRango(fecha_inicio, fecha_fin, tarifa)`: media de los
    días de la factura en `mercado_sc_cap_perd_diario`. Los días que falten se completan con
    el mes (`mercado_sc_cap`/`mercado_perd`, y si no, los valores reales mensuales de
    `market-rates.ts`: `SC_ESTIMADO_MENSUAL`, `CAP_REAL_MENSUAL`, `PERD_REAL_MENSUAL`).
    `mercado_real_fuente` indica el peor origen usado (supabase < hardcoded < fallback).
    El SC real va de ~10 a ~50 €/MWh según el día: **no usar valores fijos a mano**
    (un SC de 7-10 €/MWh fue la causa principal de ahorros inflados, ADR-0012).
  - **fee:** 0 en la API para el dashboard (Jonathan lo aplica en cliente con el deslizador,
    10 €/MWh por defecto); el comparador público manda `fee_mwh` = `FEE_PUBLICO_ENERGIA_MWH` (10).
- **Otros costes de la indexada** (`PROXIMA_CRISTALINA`, contrastado con facturas reales de
  Próxima, ADR-0013): FNEE + GO por kWh, bono social por día, tasas del 1,5 % sobre
  (mercado + fee + FNEE + GO + bono) y la **gestión de Próxima (7 €/MWh), aparte del fee del
  asesor y fuera de la base del IEE**. En la factura de Próxima el fee del asesor va dentro
  del precio de «Energía. Mercado».
- **Peajes+cargos de energía**: peajes de la Resolución CNMC 18/12/2025 y cargos de la Orden
  TED/1524/2025 (segmento 1 = 2.0TD, 2 = 3.0TD, 3 = 6.1TD). No se reutilizan los de la
  factura del cliente — son los mismos para cualquier comercializadora.
- **Tarifas fijas:** `getProductosFijos()` lee las tarifas vigentes del maestro (Supabase) y
  se comparan por total; se muestran las 2 más baratas (la 1.ª es la recomendada). A los
  productos con comisión integrada (`fee_incluido`) no se les suma el fee.
- **IEE/IVA**: NO hardcodeados — se derivan del **ratio real de la factura del cliente**
  (`importe_iee/subtotal`, `importe_iva/base_imponible`).
- **Ahorro anual:** `ahorro_estimado_anual = ahorro de la factura × 12`.

## Peajes de potencia 3.0TD — fuente y valores verificados
Fuente: **BOE-A-2025-26348** (Resolución CNMC dic. 2025, vigente 1 ene 2026).
Verificado contra Excel simulador de tarifas de Jonathan — todos los periodos coinciden al céntimo.
- Peaje = transporte + distribución (CNMC). Cargo = MITECO (parcialmente suspendido en 2026, ~60.8% del teórico).
- **P5 y P6 tienen el MISMO peaje** (0.5353 €/kW·año). El error histórico era P6=0.62 (incorrecto).
- Combinado (peaje+cargo)/365 por periodo: P1=0.055827, P2=0.029089, P3=0.012278, P4=0.010647, P5=0.006887, P6=0.003951 €/kW·día.
- Para MIMIPAU (30/35/35/35/35/60 kW, 31 días): total potencia Próxima = **123.18€** exacto.

## Flujo process-invoice
1. Claude extrae JSON: cups, tarifa, fechas, kwh, periodos, potencia_contratada,
   dias_facturados, reactiva_total, alquiler_equipos, importe_iee, base_imponible, importe_iva
2. `/api/market-historical` → PMD de los días exactos de la factura por periodo (con curva si la hay)
3. `getMercadoRealRango()` → SC, CAP y PERD de esos mismos días
4. Deriva tipo_iee y tipo_iva del ratio real de la factura
5. `simIndexada()`: PEAJ_BOE + CARG_BOE + PERD×(PMD+SC+CAP) + fee + otros costes + impuestos derivados
6. `simFija()` para cada tarifa fija vigente → ranking por total
7. En el dashboard, el fee de Jonathan se aplica en cliente (`applyFee`) — NO va al PDF del cliente

## IEE — auto-adaptativo a cualquier régimen regulatorio
- Se deriva el **tipo efectivo** de la factura real: `tipoIee = importe_iee / (base_imponible - iee - alquiler)`.
- Ese mismo tipo se aplica sobre la base monetaria de cada simulación → replica la mecánica de la factura.
- RDL 7/2026 (1.0€/MWh mínimo): tipoIee ≈ 0.64% → error ~2€ en sims (aceptable).
- Si vuelve al 5.1127%: tipoIee ≈ 5.1127% → se aplica correctamente sin tocar código.
- `applyFee` también recalcula IEE con el nuevo tipo sobre la base ampliada por el fee.
- **No hardcodear** ningún tipo de IEE ni asumir si es €/MWh o % — siempre derivar de la factura.

## PERD — ESIOS PVPCDATA (NO el Ki de la factura del cliente)
- El **Ki** que aparece en facturas de comercializadoras (ej. Acciona Ki=1.23) es propio de esa
  comercializadora y NO es el PERD que usa Próxima para calcular su indexada.
- Los crons guardan `PERD = (1 + media COF2TD) × 1,04`, ~1,040. **Ojo: `COF2TD` no es un
  coeficiente de pérdidas** (es el perfil de consumo, ≈0,0001/hora), así que en la práctica es
  un 1,04 fijo. Se mantiene como calibración: contra 5 facturas de Próxima, con el fee, da
  −1,3 % en total (ADR-0013). La desviación de cada factura la marca el perfil de consumo del
  cliente; para afinar hace falta su curva. `PERD_DEFECTO` en `market-rates.ts` es la reserva.

## Bugs corregidos (no reintroducir)
- Step2Results.tsx: cuando `ahorro_estimado_anual` es negativo (indexada más cara que la
  tarifa actual), NO mostrar el CountUp roto — usar el bloque alternativo "tarifa actual
  más competitiva".
- NUNCA comparar con el precio de mercado de HOY para una factura de un periodo pasado —
  siempre usar `/api/market-historical` con las fechas exactas de la factura.
- NUNCA usar el SC/CAP/PERD del mes de `fecha_inicio` para toda la factura: usar los días exactos.
- OMIE: leer la columna de **España** (5), no la de Portugal (4) (ADR-0012).
- ESIOS: SC/CAP con filtro peninsular (archivo 70), no los indicadores sueltos 1739-1746,
  que devuelven solo sistemas insulares (ADR-0008).
- La selección BOE/WEB ya no usa el ratio kWh/kW: se comparan totales. Si vuelve a usarse un
  ratio, normalizar `kwh_total` a 30 días: `(kwh_total * 30 / dias_facturados) / potencia_kw`.
- `dias_facturados_potencia`: campo separado para facturas con acumulación de energía donde
  la potencia solo se cobra por N días aunque el periodo de energía sea mayor. Las funciones
  `simIndexada` y `simFija` usan este valor para la potencia (fallback a `dias_facturados`).
  `kwhTotal` en simIndexada se calcula como `sum(periodos.kwh)`, no de `data.kwh_total` (que
  puede venir del medidor ≠ kWh facturados). `kwh_anuales_sips` usa `kwh_total/dias*365`.

## PDF generado (jsPDF, client-side, dashboard)
- Columnas: Factura actual | Próxima Cristalina (indexada) | las 2 fijas más baratas
- Desglose completo: potencia (por periodo), energía activa, otros costes regulados
  (FNEE/GO/bono/tasas — solo indexada), alquiler, subtotal sin impuestos,
  IEE (tipo efectivo real), base IVA, IVA, TOTAL
- Tabla por periodo con precio actual vs precio indexado (ya con el fee del deslizador)
- Aviso si el precio de mercado del periodo no estaba disponible (estimación)
- NO incluye honorarios del asesor en el PDF cliente

## Convenciones
- Componentes en PascalCase, hooks `use-` en kebab-case.
- Estilos: Tailwind utility classes.
- Auth: Supabase SSR con `createServerClient` en Server Components.
- API routes en `src/app/api/*/route.ts`; crons en `src/app/api/cron/*/route.ts` con `CRON_SECRET`.
- Tipos en `src/types/index.ts`.
- Cambios aditivos y explícitos (principio 2); documentar las decisiones en un ADR.
- Scripts de un solo uso en `_local/` (no versionado): leen `.env.local` a mano y usan `SUPABASE_SECRET_KEY`.

## Deploy
Vercel → GitHub (push/merge a `main`) → dominio `iaenergia.es`. Los crons se registran desde `vercel.json`.
