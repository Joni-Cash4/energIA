# ADR-0006 — mercado_perd desde ESIOS (archivo 70, rango de fechas)

**Estado:** Cerrado (2026-07-26). Verificado en producción — `mercado_sc_cap` (fuera de alcance de este ADR) se resolvió aparte en [ADR-0008](0008-bug-sc-cap-geo-peninsula.md), que además encontró un bug real de datos al investigarlo.

## Contexto

`mercado_perd` (coeficiente de pérdidas, usado para simular Próxima indexado) quedó fuera de alcance en el [ADR-0005](0005-datos-mercado-desde-esios.md). El sistema Python local lo obtiene hoy del archivo ESIOS 70 (PVPCDATA), campo `COF2TD`, **día a día del mes** (`fuentes_mercado.py`, `get_perd_por_periodo`): fórmula `PERD = (1 + media(COF2TD)) × 1.04`, mismo valor aplicado a las 3 tarifas × 6 periodos.

Sincronizar un mes así serían ~30 peticiones sueltas — con el mismo token que ya se bloqueó una vez por uso irresponsable, no quería asumir que una ráfaga así era segura sin comprobarlo.

**Investigación 2026-07-26** (sin implementar nada hasta confirmar): la documentación oficial de ESIOS no era concluyente sobre si el archivo 70 admite rango de fechas. Prueba real:
1. Primera petición con `start_date`/`end_date` → error 500, pero el propio mensaje reveló el parámetro que faltaba: `date_type`.
2. Con `date_type=datos` añadido, rango de 7 días → HTTP 200, respuesta = **ZIP con un JSON por día**.
3. Confirmado con un rango de mes completo (26 días disponibles del mes en curso) → mismo resultado, sin error, escalando bien.

Cada JSON diario ya trae `COF2TD` junto con el resto de campos de PVPCDATA (PMD, componentes de SC, CAP) — un solo campo, sin ambigüedad de interpretación.

## Decisión

Nuevo cron `/api/cron/mercado-perd-sync` (mensual, día 2 a las 6:00, `vercel.json`), con las mismas reglas de uso responsable que ADR-0005:

1. Mes objetivo: el mes calendario **anterior** (ya cerrado del todo, para no guardar una media parcial).
2. Si ese mes ya está en `mercado_perd`, no se llama a ESIOS.
3. Si no, **una única petición** al archivo 70 con el rango del mes completo (`date_type=datos`).
4. Se extrae `COF2TD` de los ~30 ficheros del ZIP (librería `jszip`, nueva dependencia), se promedia, se aplica la misma fórmula que el sistema local, y se guarda para las 3 tarifas × 6 periodos.

Implementado en `src/app/api/cron/mercado-perd-sync/route.ts`. Usa la misma `ESIOS_TOKEN` que [ADR-0005](0005-datos-mercado-desde-esios.md).

**`mercado_sc_cap` queda explícitamente fuera de esta ruta.** El archivo 70 trae campos (`SAHPCB`, `FOSPCB`, `PCAPPCB`...) que no se han contrastado todavía contra los indicadores sueltos que usa hoy el script local (1739-1746) para calcular SC/CAP — mapear mal ese campo afectaría a cálculos reales de cliente, así que se deja pendiente de una revisión específica antes de tocarlo.

## Consecuencias

**A favor:**
- `mercado_perd` deja de depender del PC local, con una sola petición al mes (no ~30).
- Reutiliza el mismo hallazgo de rango de fechas del archivo 70 — más simple que llamar a los 7+1 indicadores sueltos que usa el método actual.
- Coincide exactamente con la fórmula ya validada del sistema local — no se reinterpreta nada.

**Cierre — verificación en producción, 2026-07-26:**
- Confirmado con datos reales: `mercado_perd` tiene fila `mes=2026-06` (junio, mes cerrado anterior) con `updated_at=2026-07-02T06:00` — coincide exactamente con la primera ejecución del cron (día 2 a las 6:00). Corrió y sincronizó bien sin intervención.
- `mercado_sc_cap` se investigó a continuación — ver [ADR-0008](0008-bug-sc-cap-geo-peninsula.md) para el resultado (un bug real, no solo una unificación de API).
