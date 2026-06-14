# EnergIA — Frontend Next.js

Plataforma de análisis de facturas eléctricas con IA.

## Stack

- **Frontend**: Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · Framer Motion
- **Backend**: FastAPI (Python) — `api/main.py` (no incluido aquí)
- **Auth/DB**: Supabase
- **Deploy**: Vercel (frontend) + Railway (backend)

## Setup

### 1. Instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

```bash
cp .env.local.example .env.local
```

Edita `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

### 3. Inicializar Supabase

En el **SQL Editor** de tu proyecto Supabase, ejecuta el contenido de `supabase/init.sql`.

### 4. Arrancar en desarrollo

```bash
# Backend (en otro terminal)
uvicorn api.main:app --reload --port 8000

# Frontend
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Estructura

```
src/
├── app/
│   ├── page.tsx              → Landing
│   ├── comparador/           → Flujo público (3 pasos)
│   ├── mercado/              → Precios OMIE en tiempo real
│   ├── noticias/             → Noticias energéticas RSS
│   ├── login/                → Autenticación Supabase
│   └── dashboard/            → Área privada
│       ├── page.tsx          → Resumen
│       ├── nueva-factura/    → Procesar PDF
│       ├── clientes/         → Gestión de clientes
│       └── leads/            → Leads del comparador
├── components/
│   ├── ui/                   → Componentes base (shadcn-style)
│   ├── layout/               → Navbar, DashboardNav
│   ├── landing/              → Hero, Stats, HowItWorks, FinalCTA
│   └── comparador/           → Step1, Step2, Step3
├── lib/
│   ├── api.ts                → Llamadas al backend FastAPI
│   ├── supabase.ts           → Cliente Supabase
│   └── utils.ts              → Formatters, cn()
└── types/                    → TypeScript interfaces
```

## Deploy

### Vercel (frontend)

```bash
vercel --prod
```

Variables de entorno necesarias en Vercel:
- `NEXT_PUBLIC_API_URL` → URL pública de Railway
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Railway (backend)

El backend FastAPI se despliega desde `api/main.py` con:
```
uvicorn api.main:app --host 0.0.0.0 --port $PORT
```
