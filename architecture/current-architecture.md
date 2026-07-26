# Arquitectura actual (AS-IS) — IAenergía

Fotografía factual del proyecto en `C:\energIA`, tomada el 2026-07-25. Solo hechos verificados leyendo el repositorio real — sin recomendaciones ni opiniones. Se actualiza cuando algo aquí descrito deje de ser cierto.

## Stack

- **Next.js 16.2.9** (App Router) + TypeScript + Tailwind CSS + shadcn/ui (Radix) + Framer Motion
- **Supabase**: Postgres + Auth + Storage
- **Anthropic Claude**: extracción de datos de facturas subidas
- **REE API pública** (`apidatos.ree.es`): precios de mercado, sin token
- **jsPDF**: generación de PDFs en cliente (comparativas)
- **Resend**: envío de emails (avisos, boletín)
- **Deploy**: Vercel + GitHub, dominio `iaenergia.es`

> Nota: el `CLAUDE.md` del repo dice "Next.js 14" — desactualizado respecto al `package.json` real (16.2.9) en la fecha de esta fotografía.

## Páginas

**Público:** landing (`/`), `/comparador`, `/asesor`, `/mercado`, `/noticias` (+ `/noticias/boletin`), `/faq`, `/contacto`, `/privacidad`, `/login`

**Dashboard privado:** `/dashboard` (resumen), `/dashboard/clientes` (+ `[id]`), `/dashboard/contratos`, `/dashboard/leads`, `/dashboard/agenda`, `/dashboard/cartera`, `/dashboard/comisiones`, `/dashboard/facturacion`, `/dashboard/gestiones`, `/dashboard/contactos`, `/dashboard/nueva-factura`, `/dashboard/simulador`, `/dashboard/asesor-foto`

## APIs (`src/app/api/*/route.ts`)

Mercado: `market-hourly`, `market-prices`, `market-weekly`, `market-historical`
Facturas: `process-invoice`, `facturas-contrato/upload`
Comercial: `contacto`, `send-report`, `datadis/sync`, `cliente-adjuntos` (+ `upload`, `[id]`)
Boletín: `boletin/suscribir`, `boletin/baja`
Otros: `asesor-foto/upload`, `news`, `telegram/webhook`

**Crons Vercel** (`vercel.json`): `renewal-alerts` (8:00 diario), `client-followup` (9:00 diario), `invoice-collect-reminder` (día 20 del mes), `datadis-sync` (3:00 diario), `boletin-semanal` (lunes 6:00), `mercado-pmd-sync` (5:30 diario, ver [ADR-0005](adr/0005-datos-mercado-desde-esios.md)), `mercado-perd-sync` (día 2 del mes 6:00, ver [ADR-0006](adr/0006-mercado-perd-desde-esios.md))

## Tablas (Postgres/Supabase)

20 tablas, agrupadas por dominio funcional (no hay esquemas separados, todas en `public`):

| Dominio | Tablas |
|---|---|
| Comercial | `leads`, `clientes`, `contratos`, `acciones` |
| Facturas | `facturas`, `consumos_datadis`, `potencia_datadis`, `factura_validaciones` |
| Comisiones | `empresas_pago`, `comisiones_generadas` |
| Gestiones | `gestiones`, `gestion_eventos` |
| Tarifas/mercado | `tarifas_fijas`, `formulas_indexadas` (+ variante por tarifa), `mercado_sc_cap`, `mercado_perd`, `mercado_pmd_diario` |
| Otros | `cliente_adjuntos`, `contactos`, `boletin_suscriptores` |

**Multi-usuario**: existe una migración real (`multiuser_rls.sql`) que añade `user_id` + Row Level Security por-propietario a `clientes`/`facturas`/`contratos`/`acciones`, con `leads` como pool compartido entre usuarios autenticados. No confirmado si está aplicada en producción, ni si las tablas más nuevas (`comisiones_generadas`, `gestiones`, `cliente_adjuntos`) siguen el mismo patrón.

**`cups` no es una entidad normalizada**: es un campo de texto libre duplicado en `leads`, `clientes`, `contratos`, `facturas`, `consumos_datadis`, `potencia_datadis`, sin tabla propia ni clave foránea que los una. Ver [ADR-0001](adr/0001-cups-como-entidad.md).

**Migraciones sin numerar ni orden explícito**: 17 ficheros SQL sueltos en `supabase/migrations/` nombrados por funcionalidad, sin fecha ni número de secuencia. `init.sql` y `crm_contratos_acciones.sql` definen `contratos`/`acciones` de forma casi idéntica (ambas con `create table if not exists`, no hay conflicto real hoy, pero no hay una única fuente de verdad del esquema — hay que leer todos los ficheros para reconstruirlo).

## Ciclo de vida de `contratos` — comportamiento real del código (2026-07-25)

Verificado en `dashboard/contratos/page.tsx` y `api/cron/renewal-alerts/route.ts`:

- El botón "Verificar renovación" pone `renovacion_verificada = true` en la misma fila e inserta una fila en `comisiones_generadas` (tipo `renovacion`). **No modifica `fecha_vencimiento`.**
- Tanto la lista "próximos a vencer" del dashboard como el email diario del cron filtran por `renovacion_verificada = false`. **Hallazgo:** una vez verificada una renovación, ese contrato deja de generar avisos para siempre — nada avanza la fecha ni resetea el flag para el siguiente ciclo. Ver [ADR-0002](adr/0002-ciclo-vida-contrato.md) para las reglas correctas acordadas.

## Modelo de dominio

Ver [domain-model.md](domain-model.md) — entidades del negocio, sin SQL ni implementación.

## Principios de producto

Ver [product-principles.md](product-principles.md) — cómo se toman las decisiones de producto, no cómo funciona el software.

## Índice de ADRs

- [0001 — CUPS como entidad de referencia](adr/0001-cups-como-entidad.md)
- [0002 — Ciclo de vida del contrato](adr/0002-ciclo-vida-contrato.md)
- [0003 — Modelo de comisiones](adr/0003-modelo-comisiones.md)
- [0004 — Gestiones enlazadas a contrato](adr/0004-gestiones-y-contrato.md)
- [0005 — Datos de mercado desde ESIOS en vez del PC local](adr/0005-datos-mercado-desde-esios.md)
- [0006 — mercado_perd desde ESIOS (archivo 70, rango de fechas)](adr/0006-mercado-perd-desde-esios.md)
