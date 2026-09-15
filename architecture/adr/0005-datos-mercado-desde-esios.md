# ADR-0005 — Datos de mercado desde ESIOS en vez del PC local

**Estado:** Cerrado (2026-07-26). Verificado en producción y sync local desactivada el mismo día.

## Contexto

`mercado_pmd_diario` (precio marginal diario OMIE, usado por el validador y las comparativas) se sincronizaba a diario desde el sistema Python local de Jonathan, porque OMIE reparte sus precios como descarga de ficheros públicos anónimos, y ese tipo de acceso se bloquea/limita por IP de datacenter (confirmado en el código: Vercel fallaba llamando a OMIE en directo). Eso significa que la web en producción dependía de que el PC de Jonathan estuviera encendido para tener datos de mercado al día — en tensión con la visión a largo plazo de que el sistema no dependa de una sola persona/máquina (ver [[project-iaenergia-vision-largo-plazo]]).

Se investigó una alternativa: **ESIOS tiene una API oficial con token** (ya en uso por el proyecto para `mercado_perd`, vía `~/energia_local_config.py`), y su indicador **#600 "Precio mercado SPOT Diario"** es el mismo dato que el `marginalpdbc` de OMIE (mismo precio horario, misma granularidad de cuarto de hora que ya usa el sistema desde oct-2025).

**Aviso real de REE/ESIOS sobre ese mismo token:** ya se bloqueó una vez por "uso irresponsable" — peticiones masivas, redundantes, o a indicadores inexistentes. El bloqueo es por **comportamiento de las peticiones**, no por origen/IP — a diferencia del bloqueo de OMIE.

**Prueba real hecha el 2026-07-26** (una sola petición, indicador 600, un día): HTTP 200, datos correctos — confirma que el token funciona y que el dato es equivalente al de OMIE.

## Decisión

Se sustituye la sincronización de `mercado_pmd_diario` desde el PC local por un cron de Vercel (`/api/cron/mercado-pmd-sync`, `vercel.json`, 5:30 diario) que llama a ESIOS con reglas de uso responsable no opcionales:

1. Como mucho **una** petición a ESIOS por ejecución.
2. Se pide **desde el día más antiguo que falte hasta ayer**, en esa misma única petición y como mucho 31 días (nunca un día ya guardado); si ya está todo al día, no se llama a ESIOS en absoluto. Solo se guardan días completos y seguidos. *(Hasta el 2026-09-15 solo se pedía el día más antiguo que faltase: desde que el cron se retrasó una vez, iba siempre dos días por detrás — ver [ADR-0012](0012-omie-columna-portugal.md).)*
3. Los valores de cuarto de hora de España (`geo_id=3`) se agrupan por hora local (extraída directamente del campo `datetime` con offset, sin cálculo manual de zona horaria) y se promedian — misma semántica que ya usa la tabla (ver `fetchOmieDia` en `api/market-historical/route.ts`).

Implementado en `src/app/api/cron/mercado-pmd-sync/route.ts`. Requiere la variable de entorno `ESIOS_TOKEN` en Vercel (no estaba configurada — solo existía en el config local de Jonathan).

**No se toca ni se apaga la sincronización local existente** (principio de desarrollo aditivo — ver `product-principles.md`). Las dos pueden convivir mientras se verifica que el cron nuevo funciona bien en producción; cuándo dejar de depender de la local es decisión de Jonathan.

**Fuera de alcance de este ADR:** `mercado_perd` (también sincronizado hoy desde el PC local, posiblemente vía otro indicador de ESIOS) y `tarifas_fijas` (depende de un Excel local, no de un bloqueo de IP — problema distinto, con solución distinta: mover dónde vive el maestro, no una API). Ambos quedan pendientes de mirar en otro momento.

## Consecuencias

**A favor:**
- `mercado_pmd_diario` deja de depender de que el PC de Jonathan esté encendido.
- Coste cero — reutiliza el mismo token que ya existía, sin servicios de pago (proxy, etc.).
- Autocorrectivo: si el cron falla un día, la ejecución siguiente recupera todos los días que falten en su única petición. *(Así desde el 2026-09-15; antes recuperaba un día por ejecución y el retraso se quedaba fijo.)*

**Cierre — verificación en producción, 2026-07-26:**
- `ESIOS_TOKEN` ya estaba configurado en Vercel (Production) desde antes de escribir este ADR — el "trabajo pendiente" de añadirlo ya no aplicaba.
- Confirmado con datos reales: la fila más reciente de `mercado_pmd_diario` (`fecha=2026-07-25`) tiene `updated_at=2026-07-26T06:40`, justo después de la hora programada del cron (5:30) — el cron corrió y sincronizó correctamente.
- Sincronización local desactivada (decisión de Jonathan, confirmado el cron funcionando): tarea de Windows Task Scheduler `IAenergia_SyncPMD_OMIE` (ejecutaba `sync_pmd_diario.py` a diario 7:00) puesta en `Disabled` — no se eliminó, por si hay que reactivarla.
- Valorar en otro momento si `mercado_perd` puede resolverse igual con otro indicador de ESIOS (resuelto aparte en [ADR-0006](0006-mercado-perd-desde-esios.md), que reutiliza el mismo archivo 70).

**Actualización 2026-09-15 — histórico completo:**
- La tabla empezaba el 2026-07-19, así que toda factura anterior dependía de descargar OMIE en directo desde Vercel (que OMIE a veces bloquea). Se cargó el histórico del 2025-01-01 al 2026-07-18 (564 días, 13.534 horas) desde los ficheros diarios de OMIE, columna España (= ESIOS 600 `geo_id 3`, ver ADR-0012), con la misma media horaria y los días de cambio de hora agrupados igual que ESIOS. Control con los días 19-25 de julio, que ya estaban: diferencia máxima 0,005 €/MWh; relectura sin discrepancias.
- No se hizo con ESIOS porque una sola petición de 19 meses al indicador 600 devolvió 504, y trocearla eran muchas peticiones a un token que ya se bloqueó una vez. Por eso el tope de 31 días por petición del cron.
- Primera ejecución del cron nuevo (probada en local contra ESIOS y Supabase reales): una petición, recuperó el 2026-09-14 y la tabla quedó al día.
