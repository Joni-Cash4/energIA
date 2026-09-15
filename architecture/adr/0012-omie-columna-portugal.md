# ADR-0012 — Bug real: se lee el precio de Portugal en vez del de España

**Estado:** Corregido en la web, en la base y en el sistema Python local (2026-09-15). Pendiente: fallback de versiones `.2`/`.3` en `fetchOmieDia` de la web y cuantificar el impacto en €.

## Contexto

El fichero diario de OMIE `MARGINALPDBC` trae una fila por periodo con el formato `Año;Mes;Día;Periodo;Precio Portugal;Precio España;`. Casi siempre las dos columnas coinciden (MIBEL acoplado), pero cuando la interconexión con Portugal se congestiona los precios se separan, y entonces importa cuál se lee.

`fetchOmieDia` en `src/app/api/market-historical/route.ts` leía `partes[4]` (índice 0), que es **Portugal**. Su propio comentario de cabecera documentaba mal el formato (`Año;Mes;Dia;Hora(1-24);Precio(€/MWh);PrecioUnidad`).

Salió al construir la proyección de comunidades energéticas ([ADR-0011](0011-comunidades-energeticas.md)), que necesitaba un año entero de OMIE horario.

## Evidencia

**1. Qué columna es qué país.** ESIOS, indicador 600 (precio spot diario), 01/01/2025 10:00:

| Fuente | Portugal | España |
|---|---|---|
| ESIOS 600 | `geo_id 1` = 50,01 | `geo_id 3` = 35,00 |
| MARGINALPDBC 20250101, periodo 11 | columna 4 = 50,01 | columna 5 = 35,00 |

**2. Qué hay guardado en `mercado_pmd_diario`.** Comparando cada hora desacoplada con las dos columnas del fichero:

- **19-24 jul 2026** (cargados antes del cron, desde el sistema Python local): **Portugal**. Ej. 23/07 11h: base 94,737 = media col. 4; España fue 76,84.
- **Desde el 25 jul 2026** (cron `mercado-pmd-sync`, ESIOS filtrando `geo_id === 3`): **España**. 27 de 49 días con al menos una hora desacoplada, hasta 11 horas en un día; en todas, la base coincide con España.
- Matiz (2026-09-15): el **25 jul** no lo dejó el cron sino el Python, en su última ejecución (26/07 08:40, reescribe ayer + 2 días): tiene 3 decimales, que es lo que redondea el Python; el cron redondea a 2. Ese día estuvo acoplado las 24 horas, así que el valor coincide con España y no hace falta tocarlo.

**3. Comparación hora a hora de 19-24 jul** (`_local/backfill-pmd-espana-jul2026.js`, 2026-09-15). De 144 horas, 137 acopladas (solo cambia el redondeo, ≤ 0,01 €/MWh) y 7 desacopladas, todas con Portugal en la base:

| Fecha | Hora | Base (PT) | España | Δ |
|---|---|---|---|---|
| 23/07 | 11 | 94,737 | 76,85 | −17,89 |
| 23/07 | 12 | 93,760 | 38,85 | −54,91 |
| 23/07 | 13 | 91,135 | 35,60 | −55,54 |
| 23/07 | 14 | 87,540 | 38,96 | −48,58 |
| 24/07 | 10 | 78,560 | 75,93 | −2,63 |
| 24/07 | 11 | 41,642 | 12,41 | −29,23 |
| 24/07 | 12 | 7,180 | 1,48 | −5,70 |

Media diaria: 23/07 de 144,10 a 136,73; 24/07 de 112,43 a 110,87. Los demás días, sin cambio.

## Alcance

- `mercado_pmd_diario` empieza el 19-jul-2026. **Toda factura con fechas anteriores** cae en el fallback `fetchOmieDia` y, hasta este cambio, usaba Portugal en las horas desacopladas. Eso es la ruta principal del comparador y del validador para casi todo el histórico.
- El error solo aparece en horas desacopladas, pero no son raras (ver arriba) y la diferencia llega a decenas de €/MWh en esas horas. Impacto en € por factura: **sin cuantificar todavía**.
- Hallazgo secundario, mismo fallback: `fetchOmieDia` solo pide la versión `.1` del fichero. Cuando OMIE republica un día retira la `.1` y deja la `.2`: 2025-11-27 da 404 en `.1` y existe en `.2`. Esos días caen hoy a "estimación" sin necesidad. Hay que probar `.1`, `.2` y `.3` (ya lo hace `scripts/proyeccion-comunidad.mjs`). **No incluido** en este cambio para mantenerlo acotado a la columna (principio 2).
- Sistema Python local (`C:\MonitorizacionEnergetica`, origen de las filas 19-24 jul): **mismo error confirmado y corregido** — ver Decisión 3.

## Decisión

1. **Hecho (2026-09-15).** `fetchOmieDia` lee `partes[5]` (España) y exige `partes.length >= 6`; comentario de cabecera corregido. Nada más cambia en la ruta. `npx tsc --noEmit` sin errores.
2. **Hecho (2026-09-15).** Filas 19-24 jul 2026 reescritas con MARGINALPDBC col. 5, media de cuartos de hora por hora redondeada a 2 decimales (mismo criterio que el cron). Script de un solo uso `_local/backfill-pmd-espana-jul2026.js` (no versionado): compara por defecto y solo escribe con `--escribir`; se enseñó la comparación y se confirmó antes de escribir. Upsert de 144 filas, relectura con 0 discrepancias.
3. **Hecho (2026-09-15), confirmado por Jonathan.** `core/fuentes_mercado.py` leía `float(partes[4])` (Portugal) en los tres parsers de `ClienteOMIE`: `get_pmd_dia_horario` (el que usa `sync_pmd_diario.py`), `_parsear_dia` (vía `get_pmd_rango`, que usan las comparativas Python — `fuente_pmd = "OMIE_DIRECTO"`) y `_procesar_csv`. Y solo pedía la versión `.1`.
   - Ahora: constante `COL_PRECIO_ES = 5` en los tres parsers (`len(partes) > COL_PRECIO_ES`), y un único `_descargar_marginalpdbc` que prueba `.1`, `.2` y `.3` y descarta respuestas HTML; lo usan `get_pmd_dia_horario`, `get_pmd_rango` y `get_pmd_mensual`.
   - Verificado antes/después con los ficheros reales: 23/07/2026 11-14h pasa de 94,74 / 93,76 / 91,14 / 87,54 a 76,85 / 38,85 / 35,60 / 38,96 (igual que la tabla ya corregida); `get_pmd_rango` del 23/07 en 3.0TD, P1 de 135,48 a 121,22 y P2 de 118,56 a 111,62; 27/11/2025 pasa de vacío a 96 filas (versión `.2`).
   - No es un repo git: copia previa en el scratchpad de la sesión (`fuentes_mercado.py.antes-adr0012`) y el historial de versiones de Google Drive.
   - La tarea programada `IAenergia_SyncPMD_OMIE` sigue **desactivada** (última ejecución 26/07/2026) y no se ha tocado: el cron de ESIOS cubre la tabla desde el 25-jul.

`scripts/proyeccion-comunidad.mjs` ya lee la columna correcta y no usa la tabla.

## Consecuencias

- Las comparativas y validaciones ya generadas para periodos anteriores al 19-jul-2026, y las comparativas/PDFs del Python local generados antes del 2026-09-15, pueden llevar un PMD desviado en horas desacopladas. Principio 1 (transparencia sobre certeza): antes de reclamar nada a una comercializadora apoyándose en esos cálculos, recalcular.
- Los residuos del [ADR-0010](0010-pmd-por-cuarto-de-hora-no-media-de-periodo.md) (agosto 2026) salen de la tabla, desde el 25-jul ya con España: no les afecta.
