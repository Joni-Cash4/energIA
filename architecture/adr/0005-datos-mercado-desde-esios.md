# ADR-0005 — Datos de mercado desde ESIOS en vez del PC local

**Estado:** Aceptado e implementado (2026-07-26).

## Contexto

`mercado_pmd_diario` (precio marginal diario OMIE, usado por el validador y las comparativas) se sincronizaba a diario desde el sistema Python local de Jonathan, porque OMIE reparte sus precios como descarga de ficheros públicos anónimos, y ese tipo de acceso se bloquea/limita por IP de datacenter (confirmado en el código: Vercel fallaba llamando a OMIE en directo). Eso significa que la web en producción dependía de que el PC de Jonathan estuviera encendido para tener datos de mercado al día — en tensión con la visión a largo plazo de que el sistema no dependa de una sola persona/máquina (ver [[project-iaenergia-vision-largo-plazo]]).

Se investigó una alternativa: **ESIOS tiene una API oficial con token** (ya en uso por el proyecto para `mercado_perd`, vía `~/energia_local_config.py`), y su indicador **#600 "Precio mercado SPOT Diario"** es el mismo dato que el `marginalpdbc` de OMIE (mismo precio horario, misma granularidad de cuarto de hora que ya usa el sistema desde oct-2025).

**Aviso real de REE/ESIOS sobre ese mismo token:** ya se bloqueó una vez por "uso irresponsable" — peticiones masivas, redundantes, o a indicadores inexistentes. El bloqueo es por **comportamiento de las peticiones**, no por origen/IP — a diferencia del bloqueo de OMIE.

**Prueba real hecha el 2026-07-26** (una sola petición, indicador 600, un día): HTTP 200, datos correctos — confirma que el token funciona y que el dato es equivalente al de OMIE.

## Decisión

Se sustituye la sincronización de `mercado_pmd_diario` desde el PC local por un cron de Vercel (`/api/cron/mercado-pmd-sync`, `vercel.json`, 5:30 diario) que llama a ESIOS con reglas de uso responsable no opcionales:

1. Como mucho **una** petición a ESIOS por ejecución.
2. Solo se pide el **día más antiguo que falte** en la tabla (nunca uno ya guardado) — si ya está todo al día, no se llama a ESIOS en absoluto.
3. Los valores de cuarto de hora de España (`geo_id=3`) se agrupan por hora local (extraída directamente del campo `datetime` con offset, sin cálculo manual de zona horaria) y se promedian — misma semántica que ya usa la tabla (ver `fetchOmieDia` en `api/market-historical/route.ts`).

Implementado en `src/app/api/cron/mercado-pmd-sync/route.ts`. Requiere la variable de entorno `ESIOS_TOKEN` en Vercel (no estaba configurada — solo existía en el config local de Jonathan).

**No se toca ni se apaga la sincronización local existente** (principio de desarrollo aditivo — ver `product-principles.md`). Las dos pueden convivir mientras se verifica que el cron nuevo funciona bien en producción; cuándo dejar de depender de la local es decisión de Jonathan.

**Fuera de alcance de este ADR:** `mercado_perd` (también sincronizado hoy desde el PC local, posiblemente vía otro indicador de ESIOS) y `tarifas_fijas` (depende de un Excel local, no de un bloqueo de IP — problema distinto, con solución distinta: mover dónde vive el maestro, no una API). Ambos quedan pendientes de mirar en otro momento.

## Consecuencias

**A favor:**
- `mercado_pmd_diario` deja de depender de que el PC de Jonathan esté encendido.
- Coste cero — reutiliza el mismo token que ya existía, sin servicios de pago (proxy, etc.).
- Autocorrectivo: si el cron falla un día, el siguiente día recupera automáticamente el día que faltaba (una petición extra, no en ráfaga).

**Trabajo pendiente:**
- Añadir `ESIOS_TOKEN` a las variables de entorno de Vercel (Jonathan, copiándolo de su config local — no se debe pegar el valor en el chat ni en el repositorio).
- Verificar en producción que el cron corre bien unos días antes de considerar apagar la sincronización local de `mercado_pmd_diario`.
- Valorar en otro momento si `mercado_perd` puede resolverse igual con otro indicador de ESIOS.
