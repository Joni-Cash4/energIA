# ADR-0007 — tarifas_fijas se queda en Excel local (por ahora)

**Estado:** Aceptado (2026-07-26). Decisión de NO cambiar nada.

## Contexto

A diferencia de `mercado_pmd_diario` ([ADR-0005](0005-datos-mercado-desde-esios.md)) y `mercado_perd` ([ADR-0006](0006-mercado-perd-desde-esios.md)), `tarifas_fijas` no depende del PC local por un bloqueo de IP — depende de él porque el maestro (`tarifas/tarifas_maestro.xlsx`) y el proceso que lo alimenta (`tarifas_fijas.py`: detecta anexos nuevos, extrae precios con la API de Claude, actualiza el Excel, sincroniza a Supabase) viven ahí.

Diferencias que cambian la urgencia frente a los casos de mercado:
- **Es un evento, no un reloj.** Si el PC está apagado, un anexo nuevo simplemente espera — no hay un dato que se quede desactualizado en silencio día a día. Y normalmente Jonathan está delante del PC cuando sube un anexo de todas formas.
- **La edición manual en Excel es parte del flujo, no un rodeo técnico.** El maestro está pensado para editarse a mano, una fila por producto — sustituirlo quitaría una forma de trabajar que Jonathan usa activamente, no solo un paso de sincronización.
- La alternativa (una pantalla en el dashboard, subir anexo + extracción por IA + guardado directo en Supabase, mismo patrón que `process-invoice`) es una construcción nueva completa, no una extensión pequeña como los cron de ESIOS.

## Decisión

Se deja `tarifas_fijas` tal cual está: Excel local + watchdog + sync diario. No se construye una alternativa en el dashboard por ahora.

## Consecuencias

- La web sigue dependiendo del PC de Jonathan para tarifas fijas nuevas — aceptado conscientemente, no es un olvido.
- Si en el futuro cambia el contexto (ej. otro agente necesita añadir sus propias tarifas, o Jonathan deja de querer editar Excel a mano), revisar esta decisión — la opción de la pantalla en el dashboard queda descrita arriba, lista para retomar sin tener que re-investigar el flujo actual desde cero.
