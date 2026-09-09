# ADR-0010 — El PMD es cuarto-horario, no la media del periodo

**Estado:** Abierto (2026-09-09). Hallazgo confirmado contra contratos y facturas reales; la corrección en `market-historical` está pendiente de implementar.

## Contexto

`/api/market-historical` agrupa los precios de OMIE por periodo tarifario y devuelve la **media aritmética** de cada uno (`vals.reduce((s,v)=>s+v,0)/vals.length`). Ese PMD alimenta `simIndexada()` (Próxima) y el validador del término de energía (TotalEnergies JAZZ).

`architecture/product-principles.md` ya recogía que ponderar por el consumo real hora a hora era lo correcto y que la media era una limitación por falta de datos. Este ADR cierra la duda: **no es una aproximación aceptable, es una base distinta a la que usan las dos comercializadoras**, y ambas lo dicen por escrito.

## Evidencia

**1. Los contratos lo definen sub-horario, no por periodo.**

- **Próxima Cristalina** (`_local/contratos/Borrador de contrato Formula Variable Cristalina.pdf`, Condiciones Particulares):
  `CE = PEAJ + CARG + PERD x (PMD + SC + CAP)`, donde
  *"PMD: Precio marginal del mercado diario **en el cuarto de hora correspondiente** publicado por OMIE (fichero MARGINALPDBC)"*.
- **TotalEnergies JAZZ TE5** (`_local/contratos/ES0021000003259426JR_RENO_OK.pdf`, Anexo Condiciones Económicas):
  `PRECIO JAZZ INDEXADO BASE = Σ(OMIEh × Di + CMFi + ATRe)`, donde
  *"OMIEh: Precio marginal **horario** publicado por OMIE **para cada hora** del periodo de facturación"*.

**2. Validación numérica contra factura real (TotalEnergies).**

Factura FELEC2600579681 (MARIANO GOMEZ PEREZ, `ES0021000009822029MZ`, 3.0TD, 01–31/08/2026) contra su curva horaria real de Datadis, aplicando la fórmula del anexo con los `Di`/`CMFi` del anexo 17feb–3mar 2026:

| | Facturado | Fórmula con PMD aritmético | Residuo | Fórmula con PMD horario | Residuo |
|---|---|---|---|---|---|
| P3 | 156,26 | 169,90 | −13,64 | 160,19 | −3,92 |
| P4 | 155,56 | 167,53 | −11,96 | 160,91 | −5,35 |
| P6 | 204,71 | 211,68 | −6,98 | 209,56 | −4,86 |

El `CMFi` es una constante congelada al firmar, así que el método correcto es el que deja el residuo **plano**. Dispersión: **6,66 €/MWh con aritmético contra 1,42 con horario** — 4,7× más consistente. (El residuo medio de −4,71 es esperable: el anexo usado no es el de Mariano, es de otra añada.)

**3. Próxima presenta la misma firma.**

Despejando el PMD implícito de las facturas de Canales (`ES0021000010006838JH`) e hipotetizando PMD aritmético, el residuo tiene una dispersión de **10,26 €/MWh (ago-26) y 14,82 (jul-26)** entre periodos. `SC`, `CAP` y el CO del agente son comunes a todos los periodos y se cancelan en la dispersión, así que el resultado es robusto a no conocerlos: solo un `PERD` que variase ~8% entre periodos lo explicaría, y `PERD_DEFECTO` varía un 1%. No hay prueba directa porque ese CUPS no tiene autorización Datadis y no se puede reconstruir su curva.

## Decisión

`market-historical` debe ponderar el PMD por la curva real de consumo del CUPS cuando exista, y seguir devolviendo la media aritmética solo como estimación explícitamente marcada — mismo patrón que ya se usa con el origen del PERD.

La curva vive en `consumos_datadis_horario` (ver esa migración) y se alimenta del bucket `datadis-raw`.

## Consecuencias

- El error no es marginal: **7 a 14 €/MWh** en agosto de 2026 para el CUPS medido, con signo distinto según el periodo. Afecta a la ruta principal del comparador.
- Queda acotado por la cobertura de autorizaciones Datadis: hoy 1 CUPS de 343.
- Para JAZZ, el `PMD` cuarto-horario de Próxima y el horario de Total no son la misma agregación. `mercado_pmd_diario` guarda a resolución horaria; el fichero MARGINALPDBC de OMIE es cuarto-horario desde oct-2025. Habría que decidir si se guarda el cuarto de hora.

## Hallazgos secundarios, sin resolver

1. **Base de las tasas de Próxima mal compuesta.** El contrato dice *"Tasas, iguales al 1,5% de la suma de todos los conceptos anteriores, exceptuando los correspondientes a peajes y cargos"*. Verificado contra factura: la base es `Energía Mercado + FNEE + GO + bono social`, y **no** incluye el cargo de gestión (ago-26: 469,26+7,19+2,08+0,76 = 479,29 €, exactamente la base declarada; jul-26: 658,00 €, idem). `simIndexada` calcula `(mercadoPuro + feeTotal) × 0,015`, que mete la gestión y deja fuera FNEE/GO/bono. Error pequeño (+0,13 € en la factura de agosto) pero sistemático.
2. **Origen del PERD.** El contrato de Próxima nombra los ficheros `PERDQHxx` / `PERDxx` de REE, `(1 + valor) × 1,04`. El [ADR-0006](0006-mercado-perd-desde-esios.md) usa `COF2TD` de PVPCDATA. Sin contrastar si coinciden.
3. **`HORAS_PERIODO`** (`market-rates.ts`) está definido y no se usa en ningún sitio; además tiene P6 como solo las horas 0–7, sin fines de semana. Borrarlo o arreglarlo antes de que alguien lo use.
4. **`getPeriodo` usaba `toISOString()`** para la comprobación de festivo mientras el resto de la función lee la fecha en local — en `Europe/Madrid` miraba el día anterior. Corregido en esta misma sesión; en Vercel (UTC) no se manifestaba.
