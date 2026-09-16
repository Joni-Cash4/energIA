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

## Actualización 2026-09-15 — SC, CAP y PERD también por día

- **Problema:** con un valor por mes, cada factura usaba el mes de `fecha_inicio` aunque abarcase dos meses, y el mes en curso no existía hasta el día 2 del siguiente, así que caía en valores de reserva.
- **Tabla nueva** `mercado_sc_cap_perd_diario` (`supabase/migrations/mercado_sc_cap_perd_diario.sql`) y **cron diario** `/api/cron/mercado-sc-cap-perd-diario` (6:15, `vercel.json`), con las mismas reglas de uso responsable que el [ADR-0005](0005-datos-mercado-desde-esios.md): una petición al archivo 70 desde el día más antiguo que falte hasta ayer, como mucho 31 días, y solo días completos y seguidos. Mismo cálculo que el cron mensual, pero por día. Las tablas mensuales se quedan como están.
- **Cálculo:** `process-invoice` usa `getMercadoRealRango`, la media de los días exactos de la factura; los días que falten se completan con su mes. El Python (`fuentes_mercado.obtener_precios_mercado`) lee la misma tabla y, desde el mismo día, también el PMD de `mercado_pmd_diario`: los dos sistemas calculan con los mismos datos y solo descargan de ESIOS u OMIE si falta alguno.
- **Histórico cargado:** 622 días, del 2025-01-01 al 2026-09-14. De enero de 2025 a abril de 2026 salieron del ZIP que ya estaba descargado; de mayo a septiembre, de una sola petición. Control: la media de cada uno de los 20 meses coincide exacta con `mercado_sc_cap` y `mercado_perd`. El SC diario va de 10,2 a 50,5 €/MWh, una variación que el valor mensual escondía.
- **Efecto:** septiembre de 2026 (mes en curso) pasa del valor de reserva (26,3 €/MWh) al real de sus días (30,59). Una factura del 20/03 al 10/04 pasa de usar solo marzo (38,98) a sus días exactos (39,04). En un mes completo apenas cambia, salvo en los meses con cambio de hora, porque aquí cada día pesa igual y el mensual pesa cada hora: marzo de 2026, 38,988 frente a 38,976 €/MWh (MIMIPAU, −1,66 €/año).
- **Corrección 2026-09-16:** en su primera ejecución en producción el cron diario no guardó nada. Faltaba un solo día (el 15), y con un rango de un día el archivo 70 no devuelve un ZIP sino el JSON suelto (24 registros), así que `JSZip` fallaba. Ahora, si la respuesta no empieza por la firma de ZIP (`PK`), se lee como un único JSON. Probado en local contra ESIOS y Supabase reales: guarda el 15/09 con los mismos SC, CAP y PERD que salen del JSON crudo. El cron mensual no está afectado (siempre pide un mes entero), ni el Python (pide día a día y ya lee JSON).
