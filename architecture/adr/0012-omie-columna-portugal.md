# ADR-0012 — Bug real: se lee el precio de Portugal en vez del de España

**Estado:** Corregido en la web (columna y versiones `.2`/`.3`), en la base y en el sistema Python local (columna y calendario de periodos) (2026-09-15). Pendiente: cuantificar el impacto en €.

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
- Matiz (2026-09-15): el **25 jul** no lo dejó el cron sino el Python, en su última ejecución (26/07 08:40, reescribe ayer + 2 días): tiene 3 decimales, que es lo que redondea el Python; el cron redondea a 2. Ese día estuvo acoplado las 24 horas, así que el valor coincide con España y no hace falta tocarlo. Por lo mismo, la comprobación del [ADR-0005](0005-datos-mercado-desde-esios.md) («la fila 2026-07-25 tiene `updated_at=2026-07-26T06:40`, justo después del cron») no demostraba el cron: 06:40 UTC son las 08:40 en España, la hora de la tarea del Python. El cron escribe hacia las 08:05 hora España.

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
- Hallazgo secundario, mismo fallback: `fetchOmieDia` solo pide la versión `.1` del fichero. Cuando OMIE republica un día retira la `.1` y deja la `.2`: 2025-11-27 da 404 en `.1` y existe en `.2`. Esos días caen hoy a "estimación" sin necesidad. Hay que probar `.1`, `.2` y `.3` (ya lo hace `scripts/proyeccion-comunidad.mjs`). **Corregido** en un commit aparte del de la columna (ver Decisión 4).
- Sistema Python local (`C:\MonitorizacionEnergetica`, origen de las filas 19-24 jul): **mismo error confirmado y corregido** — ver Decisión 3.
- Hallazgo de la revisión (2026-09-15): el cron `mercado-pmd-sync` va **dos días por detrás de forma permanente**. Carga un único día por ejecución (el último guardado + 1) y, desde que se retrasó una vez, nunca recupera: 51 de los 56 días desde el 20-jul se escribieron con 2 días de desfase (ej. el 13/09 se escribió el 15/09 a las 08:04). Las facturas que terminan ayer o anteayer caen por eso al fallback `fetchOmieDia`, que tras este ADR ya lee España. **Corregido el 2026-09-15** (decisión de Jonathan): el cron pide en su única petición todos los días que falten hasta ayer, y se cargó el histórico desde el 2025-01-01. Detalle en el [ADR-0005](0005-datos-mercado-desde-esios.md).
- Hallazgo aparte, **corregido el 2026-09-15** (confirmado por Jonathan): `_get_periodo` del Python (`fuentes_mercado.py`), con el que `get_pmd_rango` reparte el PMD por periodo en las comparativas Python, no aplicaba temporadas. En 3.0TD ponía siempre la punta en P1 y el llano en P2, la noche laborable en P3 y los sábados en P4/P5/P6: el 63 % de las horas en el periodo equivocado (el 5,8 % en 2.0TD). Ej. 27/11/2025 (media-alta): ponía la punta en P1, cuando es P2.
  - Ahora es un port 1:1 de `src/lib/periodos.ts` (con zonas), verificado hora a hora 2025-2027 en 3 tarifas × 3 zonas sin ninguna diferencia. El relleno de periodos sin horas en el rango es también el de la web (P6, si no P5, P4 o P3, para todo P1-P6): con el calendario nuevo, en abril no hay horas de P1-P3 y quien lo usa lee `pmd.get(p, 0)`.
  - Antes/después con la curva Datadis real de un cliente 3.0TD (sep-2025 a ago-2026), término de mercado Σ kWh × PERD × PMD: antes 1.672,12 €, después 1.821,99 €, curva real hora a hora 1.657,76 €. El calendario viejo acertaba en el total porque sus errores se compensaban (de −28 a +29 € al mes); el nuevo sobreestima todos los meses (de +2 a +29 €) porque usa la media simple del periodo sin ponderar por el consumo ([ADR-0010](0010-pmd-por-cuarto-de-hora-no-media-de-periodo.md)). Error medio mensual casi igual: 13,4 € antes, 13,7 € después. Lo que acerca el cálculo al real es ponderar por la curva cuando la hay, como ya hace la web.
  - Copia previa en el scratchpad de la sesión (`fuentes_mercado.py.antes-calendario`) y el historial de versiones de Google Drive.
- Mismo tema, **corregido el 2026-09-15**: la web (`src/lib/periodos.ts`) y el Python ponían en 2.0TD la hora 9-10h en punta (P1). La Circular CNMC 3/2020, art. 7.3 ([BOE-A-2020-1066](https://www.boe.es/buscar/act.php?id=BOE-A-2020-1066)), fija la punta de 2.0TD en 10-14h y 18-22h, el llano en 8-10h, 14-18h y 22-24h, y el valle en 0-8h más sábados, domingos, 6 de enero y festivos nacionales. Corregido en los dos a la vez, y el Python sigue coincidiendo con la web hora a hora (0 diferencias en 236.520 horas). En 3.0TD la punta sí empieza a las 9h. La página pública `/mercado`, que llevaba su propia copia del calendario (con la punta de 3.0TD a las 10h y sin festivos), usa ahora `getPeriodo`: comprobado en el navegador el martes 15/09 (temporada media), 3.0TD P4 8-9h, P3 9-14h, P4 14-18h, P3 18-22h; 2.0TD P2 8-10h, P1 10-14h, P2 14-18h, P1 18-22h.

## Decisión

1. **Hecho (2026-09-15).** `fetchOmieDia` lee `partes[5]` (España) y exige `partes.length >= 6`; comentario de cabecera corregido. En ese commit no cambia nada más de la ruta. `npx tsc --noEmit` sin errores.
2. **Hecho (2026-09-15).** Filas 19-24 jul 2026 reescritas con MARGINALPDBC col. 5, media de cuartos de hora por hora redondeada a 2 decimales (mismo criterio que el cron). Script de un solo uso `_local/backfill-pmd-espana-jul2026.js` (no versionado): compara por defecto y solo escribe con `--escribir`; se enseñó la comparación y se confirmó antes de escribir. Upsert de 144 filas, relectura con 0 discrepancias.
3. **Hecho (2026-09-15), confirmado por Jonathan.** `core/fuentes_mercado.py` leía `float(partes[4])` (Portugal) en los tres parsers de `ClienteOMIE`: `get_pmd_dia_horario` (el que usa `sync_pmd_diario.py`), `_parsear_dia` (vía `get_pmd_rango`, que usan las comparativas Python — `fuente_pmd = "OMIE_DIRECTO"`) y `_procesar_csv`. Y solo pedía la versión `.1`.
   - Ahora: constante `COL_PRECIO_ES = 5` en los tres parsers (`len(partes) > COL_PRECIO_ES`), y un único `_descargar_marginalpdbc` que prueba `.1`, `.2` y `.3` y descarta respuestas HTML; lo usan `get_pmd_dia_horario`, `get_pmd_rango` y `get_pmd_mensual`.
   - Verificado antes/después con los ficheros reales: 23/07/2026 11-14h pasa de 94,74 / 93,76 / 91,14 / 87,54 a 76,85 / 38,85 / 35,60 / 38,96 (igual que la tabla ya corregida); `get_pmd_rango` del 23/07 en 3.0TD, P1 de 135,48 a 121,22 y P2 de 118,56 a 111,62; 27/11/2025 pasa de vacío a 96 filas (versión `.2`).
   - No es un repo git: copia previa en el scratchpad de la sesión (`fuentes_mercado.py.antes-adr0012`) y el historial de versiones de Google Drive.
   - La tarea programada `IAenergia_SyncPMD_OMIE` sigue **desactivada** (última ejecución 26/07/2026) y no se ha tocado: el cron de ESIOS cubre la tabla desde el 26-jul.
   - Al verificarlo salieron dos fallos más del Python, corregidos el mismo día:
     - `C:\MonitorizacionEnergetica\reiniciar_agente.ps1` estaba en UTF-8 sin BOM y Windows PowerShell 5.1 no llegaba a leerlo (la raya «—» de los comentarios se convertía en unas comillas y rompía el script). La tarea `IAenergia_ReiniciarAgente_v2` no ha funcionado nunca: el agente solo cogía código nuevo al reiniciar el ordenador. Se volvió a guardar con BOM, sin cambiar el contenido, y el reinicio funciona (`log_reinicios.txt` ya existe).
     - `obtener_precios_mercado` llamaba a `get_sc_por_periodo` / `get_cap_por_periodo`, que el [ADR-0008](0008-bug-sc-cap-geo-peninsula.md) unificó en `get_sc_cap_por_periodo`. Con un mes sin caché en `mercado_sc_cap` (hoy, todo lo anterior a abril de 2026) el Python fallaba con `AttributeError`. Corregido y probado con un ESIOS simulado. Ojo: un mes sin caché hace 62 peticiones a ESIOS (una por día para SC/CAP y otra por día para PERD). Para no depender de eso, el 2026-09-15 se cargaron en `mercado_sc_cap` y `mercado_perd` los 15 meses de enero de 2025 a marzo de 2026 con **una sola petición** al archivo 70 (mismo cálculo que el cron `mercado-perd-sync`). Abril de 2026, que ya estaba, se usó de control y coincidió exacto; relectura sin discrepancias. El ZIP crudo y el script quedan en `MonitorizacionEnergetica/datos_mercado/esios/`.
   - Prueba con una factura real 3.0TD de mayo de 2026 (kWh en P4/P5/P6, que es la temporada baja), pasada por el pipeline completo del agente con la salida en el scratchpad, sin tocar la carpeta del cliente: coste de la indexada 450,79 → 496,81 €/factura y ahorro estimado 1.471 → 919 €/año. El informe que se generó para ese cliente el 16/06/2026 sobrestimaba el ahorro en unos 550 €/año.
   - **PMD ponderado por la curva real también en el Python** (2026-09-15, ver [ADR-0010](0010-pmd-por-cuarto-de-hora-no-media-de-periodo.md)): `obtener_precios_mercado` acepta `cups`. Si el CUPS tiene curva Datadis en Supabase (`consumos_datadis_horario`) que cubre al menos el 95 % de las horas del rango, la media de cada periodo se pondera por el consumo, igual que la web, y `fuente_pmd` pasa a `OMIE_DIRECTO_CURVA`. Sin curva, o con menos cobertura, media simple como antes. El agente pasa el CUPS de la factura. Con la curva real del cliente de la comparativa de 12 meses, el término de mercado pasa de 1.821,99 € (media simple) a 1.657,86 €, frente a 1.657,76 € calculado hora a hora. Sin curva no cambia nada: la factura de mayo sigue en 919,20 €/año.
4. **Hecho (2026-09-15), commit aparte.** `fetchOmieDia` prueba `.1`, `.2` y `.3` en ese orden, igual que `scripts/proyeccion-comunidad.mjs` y el Python. Verificado con el servidor de desarrollo sin Supabase, para forzar el fallback: el 27/11/2025 pasa de "OMIE no disponible" a datos reales (versión `.2`); el 23/07/2026 da P1 121,22 y P2 111,62, igual que el Python corregido (con Portugal eran 135,48 y 118,56).

`scripts/proyeccion-comunidad.mjs` ya lee la columna correcta y no usa la tabla.

## Consecuencias

- Las comparativas y validaciones ya generadas para periodos anteriores al 19-jul-2026, y las comparativas/PDFs del Python local generados antes del 2026-09-15, pueden llevar un PMD desviado en horas desacopladas. Los del Python, además, repartían el PMD por periodos con un calendario sin temporadas. Principio 1 (transparencia sobre certeza): antes de reclamar nada a una comercializadora apoyándose en esos cálculos, recalcular.
- Los residuos del [ADR-0010](0010-pmd-por-cuarto-de-hora-no-media-de-periodo.md) (agosto 2026) salen de la tabla, desde el 25-jul ya con España: no les afecta.
