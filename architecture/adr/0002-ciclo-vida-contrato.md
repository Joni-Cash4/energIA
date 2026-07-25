# ADR-0002 — Ciclo de vida del contrato

**Estado:** Aceptado (2026-07-25). Decisión de diseño — no implementado todavía en código ni base de datos.

## Contexto

Comportamiento real verificado en el código (`dashboard/contratos/page.tsx`, `api/cron/renewal-alerts/route.ts`) el 2026-07-25: el botón "Verificar renovación" marca `renovacion_verificada = true` en la misma fila e inserta una comisión (`comisiones_generadas`, tipo `renovacion`), pero **no toca `fecha_vencimiento`**. Tanto la lista de "próximos a vencer" como el email diario del cron filtran por `renovacion_verificada = false` — así que en cuanto se verifica una renovación, ese contrato deja de generar avisos para siempre. Hoy Jonathan actualiza la fecha a mano.

Reglas de negocio confirmadas por Jonathan (2026-07-25):
- Al renovar con la misma comercializadora, el contrato sigue siendo la misma relación — el nuevo periodo se cuenta **desde la fecha real en que se renueva**, no desde la fecha de vencimiento antigua (ej.: vence el 28, se renueva el 30 → el año nuevo empieza el 30).
- Al renovar se renegocian precio y comisión, aunque sea la misma comercializadora.
- Durante el año, un cliente puede cambiar de producto (tarifa fija → indexada, o viceversa) con la misma comercializadora. Esto afecta a la comisión según el producto, pero **no reinicia el contador de vencimiento**.
- Si el cliente cambia de comercializadora, es un evento distinto: hay retrocomisión de la relación anterior + comisión nueva, y el contador de renovación **se reinicia al 100% a 12 meses**.
- `estado` (activo/pendiente/baja) y `estado_firma` (pendiente_firma/firmado/rechazado) son ejes independientes: `estado_firma` es papeleo, `estado` indica si ese contrato es "nuestro" ahora mismo de verdad (importante porque un contrato puede haber sido nuestro y ya no serlo).
- `baja` agrupa 4 motivos distintos: cambio de gestor, cambio de comercializadora, el cliente cierra el negocio, o se da de baja el propio CUPS. Jonathan confirma que **siempre interesa apuntar el motivo**.

## Decisión

Reglas por tipo de evento:

| Evento | Fila de contrato | Fecha de vencimiento | Comisión |
|---|---|---|---|
| Alta | Nuevo | Fecha de alta + duración | `alta` |
| Renovación, misma comercializadora | Misma fila | Fecha real de renovación + duración (no la fecha de vencimiento antigua) | `renovacion` |
| Cambio de producto, misma comercializadora | Misma fila (se actualiza `producto`) | No cambia | `correccion` |
| Cambio de comercializadora | Contrato viejo → `baja` (motivo: cambio de comercializadora). Contrato **nuevo** para la comercializadora nueva | Nueva, contador reiniciado a 12 meses | Retrocomisión (`correccion` en negativo) sobre el contrato viejo + `alta` sobre el nuevo |
| Baja (cierre de negocio / CUPS dado de baja / cambio de gestor) | Misma fila → `estado = baja` | — | Según corresponda |

Esto reutiliza el mismo patrón que [ADR-0001](0001-cups-como-entidad.md) para un CUPS que cambia de titular: una relación que termina se congela como histórico en su propia fila; una relación nueva abre una fila nueva.

Se añade un campo `motivo_baja` a `contratos` para registrar cuál de los 4 motivos aplica.

## Consecuencias

**A favor:**
- El histórico de comisiones y vencimientos queda correcto sin intervención manual, incluida la fecha ancla en la renovación real (no en la fecha de vencimiento teórica).
- Los avisos de renovación pueden seguir funcionando de forma indefinida, ciclo tras ciclo, sin que un contrato "desaparezca" del radar tras la primera renovación verificada.
- Reporting futuro por motivo de baja (cuántas son por cambio de gestor vs. cierre de negocio, etc.) queda disponible sin tener que reconstruirlo a mano.

**Trabajo pendiente que esto implica (no hecho todavía):**
- Automatizar el avance de `fecha_vencimiento` al verificar una renovación (hoy es manual).
- Automatizar el resetear `renovacion_verificada` a `false` en el nuevo ciclo.
- Implementar el flujo de "cambio de comercializadora" como cierre de contrato + apertura de uno nuevo + retrocomisión, en vez de editar el contrato existente.
- Añadir columna `motivo_baja` a `contratos`.
