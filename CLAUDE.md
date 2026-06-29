# IAenergía — Landing + Comparador (Next.js)

## Qué hace este proyecto
Web pública `iaenergia.es` para captación de clientes del asesor energético Jonathan.
Explica el servicio, muestra precios de mercado en tiempo real, y permite subir facturas
para obtener una comparativa real de ahorro vs tarifa indexada y tarifa fija.

**IMPORTANTE:** No somos comercializadora. No nombrar empresas públicamente.
Analizamos todas las compañías pero operamos con dos en concreto (no nombrar).
Mensaje: "Analizamos todas las compañías" + comparativa "Tu factura actual vs Tarifa Indexada vs Tarifa Fija".

## Stack
- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **shadcn/ui** (Radix UI) + **Framer Motion** (animaciones)
- **Supabase** (auth + DB): `src/lib/supabase.ts`
- **Recharts** para gráficas de mercado
- **Anthropic Claude** (claude-sonnet-4-6) para extracción de facturas
- **REE API pública** (`apidatos.ree.es`) — sin token, PVPC/OMIE — NO usar ESIOS

## Estructura src/
```
src/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   ├── login/page.tsx
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── nueva-factura/page.tsx   # Upload factura + comparativa + PDF 3 columnas
│   ├── mercado/page.tsx
│   ├── comparador/
│   ├── asesor/page.tsx
│   └── api/
│       ├── market-hourly/route.ts   # GET: PVPC hora a hora (REE pública, sin token)
│       ├── market-prices/route.ts
│       ├── market-weekly/route.ts
│       ├── process-invoice/route.ts # POST: extrae factura + calcula sim_indexada + sim_fija
│       └── contacto/route.ts
├── components/
│   ├── landing/
│   ├── layout/
│   └── comparador/
├── lib/
│   ├── api.ts               # processInvoice(files: File[])
│   ├── cnmc-rates.ts        # Tarifas CNMC 2026 confirmadas de facturas reales
│   ├── supabase.ts
│   ├── utils.ts
│   └── use-toast.ts
└── types/
    └── index.ts             # SimTarifa, InvoiceAnalysis con sim_indexada + sim_fija
```

## Comandos
```powershell
cd D:\Claude\energIA
npm run dev       # Dev en http://localhost:3000
npm run build     # Build producción
npx tsc --noEmit  # Solo verificar tipos
```

## Variables de entorno (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=https://iaenergia.es
ANTHROPIC_API_KEY=...
# NO hace falta ESIOS_TOKEN — usamos apidatos.ree.es (pública)
```

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

## Periodos tarifarios 3.0TD Península (src/lib/periodos.ts)
Fuente: BOE-A-2001-20850 / CNMC Circular 3/2020. Única fuente de verdad — usar `getPeriodo()`.
- **Valle 00-08h** → P6 siempre (cualquier día/temporada)
- **Sáb/Dom/Festivo** → P6 todo el día
- **Laborable 08-24h**: punta (09-14h, 18-22h) / llano (08-09h, 14-18h, 22-24h):
  - Alta (ene,feb,jul,dic): punta=P1, llano=P2
  - Media-Alta (mar,nov):   punta=P2, llano=P3
  - Media (jun,ago,sep):    punta=P3, llano=P4
  - Baja (abr,may,oct):     punta=P4, llano=P5

## Lógica de simulación v3.0 (src/lib/market-rates.ts)
Motor portado 1:1 desde el sistema Python probado en producción
(`C:\MonitorizacionEnergetica\sistema\core\motor_calculo.py` + `fuentes_mercado.py` +
`modules\tarifas_atulado.py`). Tablas BOE 2026 completas para 2.0TD/3.0TD/6.1TD:
peajes/cargos energía y potencia, CAP, PERD por defecto, Atulado BOE+WEB.

## Peajes de potencia 3.0TD — fuente y valores verificados
Fuente: **BOE-A-2025-26348** (Resolución CNMC dic. 2025, vigente 1 ene 2026).
Verificado contra Excel simulador de tarifas de Jonathan — todos los periodos coinciden al céntimo.
- Peaje = transporte + distribución (CNMC). Cargo = MITECO (parcialmente suspendido en 2026, ~60.8% del teórico).
- **P5 y P6 tienen el MISMO peaje** (0.5353 €/kW·año). El error histórico era P6=0.62 (incorrecto).
- Combinado (peaje+cargo)/365 por periodo: P1=0.055827, P2=0.029089, P3=0.012278, P4=0.010647, P5=0.006887, P6=0.003951 €/kW·día.
- Para MIMIPAU (30/35/35/35/35/60 kW, 31 días): total potencia Próxima = **123.18€** exacto.

- **Fórmula mercado Próxima Cristalina**: `PERD × (PMD_histórico + SC + CAP)`
  - PMD: precio OMIE real del **periodo exacto de la factura** (no el de hoy) vía
    `/api/market-historical` (REE pública, agrupado por periodo tarifario)
  - SC: servicios de ajuste — histórico mensual estimado (sin acceso ESIOS desde Vercel)
  - CAP: 0.00112 €/kWh (BOE 2026)
  - PERD: coeficiente de pérdidas por periodo (tabla regulatoria)
- **Peajes+cargos**: tablas oficiales BOE 2026 por tarifa y periodo (no se reutilizan los
  de la factura del cliente — son los mismos para cualquier comercializadora)
- **Cargo gestión Próxima**: 0.007 €/kWh + FNEE + GO + bono social + tasas 1.5%
- **Atulado BOE y WEB**: tarifas fijas completas (energía + potencia, todas las tarifas).
  Selección automática BOE/WEB según ratio kWh/kW (>50 → WEB)
- **IEE/IVA**: NO hardcodeados — se derivan del **ratio real de la factura del cliente**
  (`importe_iee/subtotal`, `importe_iva/base_imponible`). Esto adapta automáticamente
  a 2.0TD vs 3.0TD y a la reducción RDL 17/2021 sin tener que modelar las reglas exactas.

## Flujo process-invoice
1. Claude extrae JSON: cups, tarifa, fechas, kwh, periodos, potencia_contratada,
   dias_facturados, reactiva_total, alquiler_equipos, importe_iee, base_imponible, importe_iva
2. `/api/market-historical` → PMD real OMIE del periodo exacto de la factura (por periodo tarifario)
3. Deriva tipo_iee y tipo_iva del ratio real de la factura
4. `simIndexada()`: PEAJ_BOE + CARG_BOE + PERD×(PMD+SC+CAP) + fee + otros costes + impuestos derivados
5. `simFija()` ×2 (BOE y WEB): tarifas fijas Atulado + mismos impuestos derivados
6. Fee Jonathan se aplica en cliente (dashboard) sobre sim_indexada — NO va al PDF del cliente

## IEE — auto-adaptativo a cualquier régimen regulatorio
- Se deriva el **tipo efectivo** de la factura real: `tipoIee = importe_iee / (base_imponible - iee - alquiler)`.
- Ese mismo tipo se aplica sobre la base monetaria de cada simulación → replica la mecánica de la factura.
- RDL 7/2026 (1.0€/MWh mínimo): tipoIee ≈ 0.64% → error ~2€ en sims (aceptable).
- Si vuelve al 5.1127%: tipoIee ≈ 5.1127% → se aplica correctamente sin tocar código.
- `applyFee` también recalcula IEE con el nuevo tipo sobre la base ampliada por el fee.
- **No hardcodear** ningún tipo de IEE ni asumir si es €/MWh o % — siempre derivar de la factura.

## PERD real mensual — ESIOS PVPCDATA (NO el Ki de la factura del cliente)
- El **Ki** que aparece en facturas de comercializadoras (ej. Acciona Ki=1.23) es propio de esa
  comercializadora y NO es el PERD que usa Próxima para calcular su indexada.
- El PERD correcto para simular Próxima es el que da **ESIOS PVPCDATA** (COF2TD).
- Se obtiene ejecutando el sistema Python local — Vercel nunca llama a ESIOS.
- Valores en `PERD_REAL_MENSUAL` en market-rates.ts, leídos por `getMercadoReal` como tier 2.
- **2026-03 (3.0TD)**: 1.040 para todos los periodos — confirmado Python comparativa MIMIPAU 20260616.
- Actualizar mensualmente vía Supabase (`mercado_perd`) o hardcodeado aquí como fallback.

## Bugs corregidos (no reintroducir)
- Step2Results.tsx: cuando `ahorro_estimado_anual` es negativo (indexada más cara que la
  tarifa actual), NO mostrar el CountUp roto — usar el bloque alternativo "tarifa actual
  más competitiva".
- NUNCA comparar con el precio de mercado de HOY para una factura de un periodo pasado —
  siempre usar `/api/market-historical` con las fechas exactas de la factura.
- Ratio BOE/WEB: `kwhTotal` debe normalizarse a 30 días antes de dividir por kW. Sin
  normalizar, una factura de 242 días da ratio 8× inflado → recomienda WEB cuando
  debería ser BOE. Fórmula correcta: `(kwh_total * 30 / dias_facturados) / potencia_kw`.

## PDF generado (jsPDF, client-side)
- **4 columnas**: Factura actual | Próxima Cristalina | Atulado BOE | Atulado WEB
- Desglose completo: potencia, energía activa, cargo gestión (fee), otros costes regulados
  (FNEE/GO/bono/tasas — solo indexada), reactiva, alquiler, subtotal sin impuestos,
  IEE (tipo efectivo real), base IVA, IVA, TOTAL
- Marca ★ en la opción fija recomendada (BOE o WEB según ratio kWh/kW)
- Tabla por periodo con precio actual vs precio indexado (al final)
- Footer incluye fuente de PERD (ESIOS real / confirmado / estimación)
- NO incluye honorarios del asesor ni nombres de empresas en el PDF cliente

## Convenciones
- Componentes en PascalCase, hooks `use-` en kebab-case.
- Estilos: Tailwind utility classes.
- Auth: Supabase SSR con `createServerClient` en Server Components.
- API routes en `src/app/api/*/route.ts`.
- Tipos en `src/types/index.ts`.

## Deploy
Vercel → GitHub push → dominio `iaenergia.es`
