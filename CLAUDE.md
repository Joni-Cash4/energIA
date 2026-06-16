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

## Lógica de simulación v3.0 (src/lib/market-rates.ts)
Motor portado 1:1 desde el sistema Python probado en producción
(`C:\MonitorizacionEnergetica\sistema\core\motor_calculo.py` + `fuentes_mercado.py` +
`modules\tarifas_atulado.py`). Tablas BOE 2026 completas para 2.0TD/3.0TD/6.1TD:
peajes/cargos energía y potencia, CAP, PERD por defecto, Atulado BOE+WEB.

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

## Bugs corregidos (no reintroducir)
- Step2Results.tsx: cuando `ahorro_estimado_anual` es negativo (indexada más cara que la
  tarifa actual), NO mostrar el CountUp roto — usar el bloque alternativo "tarifa actual
  más competitiva".
- NUNCA comparar con el precio de mercado de HOY para una factura de un periodo pasado —
  siempre usar `/api/market-historical` con las fechas exactas de la factura.

## PDF generado (jsPDF, client-side)
- 3 columnas: Factura actual | Tarifa Indexada | Tarifa Fija (IVA 10%)
- Incluye desglose: energía, potencia, reactiva, IEE, alquiler, IVA, TOTAL
- Tabla periodos con precio actual vs precio indexado hoy
- NO incluye honorarios del asesor ni nombres de empresas

## Convenciones
- Componentes en PascalCase, hooks `use-` en kebab-case.
- Estilos: Tailwind utility classes.
- Auth: Supabase SSR con `createServerClient` en Server Components.
- API routes en `src/app/api/*/route.ts`.
- Tipos en `src/types/index.ts`.

## Deploy
Vercel → GitHub push → dominio `iaenergia.es`
