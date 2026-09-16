# ADR-0013 — Costes de la indexada contrastados con facturas reales de Próxima

**Estado:** Aceptado (2026-09-16). Peajes, cargos y otros costes corregidos en la web y en el Python local. Pendiente: afinar el término de mercado con la curva de algún cliente.

## Contexto

Hasta ahora la simulación de la indexada se había validado con datos de ESIOS y con facturas de otras compañías, pero nunca línea a línea contra facturas de Próxima. Jonathan aportó 5 facturas reales de clientes suyos ya pasados a Próxima (3.0TD):
- …6838JH: 16-31/07 y agosto;
- …3532WJ: 04-31/08;
- …6282FK y …6279FH: 28-31/08.

Los fees de esos contratos están en `contratos.fee_energia_mwh`: 18, 30, 16 y 20 €/MWh.

## Hallazgos

**Estructura de la factura de Próxima:**
- «Energía. Peajes y cargos» por periodo.
- «Energía. Mercado» por periodo: **incluye el fee del asesor**.
- «Otros costes»: FNEE, GO, bono social, tasas y alquiler.
- «Cargos por gestión»: 7 €/MWh de Próxima, **aparte** del fee del asesor.
- Impuestos:
  - la base del IEE incluye potencia, excesos, peajes y cargos, mercado, reactiva y otros costes sin el alquiler;
  - **la gestión queda fuera de la base del IEE**, y entra en la del IVA con el alquiler.
- Las tasas son el **1,5 % de (mercado + FNEE + GO + bono)**. Cuadra al céntimo en las 5 facturas.

**Peajes y cargos de energía mal en el código:**
- **3.0TD:** P3 0,0265 en el código frente a 0,019279 en la factura; P4 0,0123 frente a 0,009795.
- **2.0TD:** usaba los cargos del 3.0TD. En la punta faltaban 34 €/MWh.
- **6.1TD:** tenía valores inventados.

Los correctos salen de dos normas:
- peajes, de la Resolución CNMC de 18/12/2025 ([BOE-A-2025-26348](https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26348));
- cargos, de la Orden TED/1524/2025 ([BOE-A-2025-26705](https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26705)), segmentos 1 (2.0TD), 2 (3.0TD) y 3 (6.1TD).

Comprobaciones:
- 3.0TD = facturas de Próxima;
- 2.0TD = `TEUPCB` de ESIOS PVPCDATA (97,55 / 29,27 / 3,29 €/MWh, que además confirma que la punta 2.0TD empieza a las 10h).

**Otros costes desactualizados:**
- FNEE: 0,001521 en el código frente a 0,002658 €/kWh en agosto (0,002437 en julio).
- Bono social: 0,019121 frente a 0,024661 €/día en agosto.
- La web no sumaba la gestión de 7 €/MWh; solo el fee del deslizador.
- El Python sumaba dos veces FNEE, GO, bono y tasas: dentro del precio de cada periodo y otra vez como otros costes.

**Término de mercado:**
- `COF2TD` de PVPCDATA **no es un coeficiente de pérdidas**, sino el perfil de consumo tipo (≈0,0001 por hora). Por tanto, `PERD = (1 + media COF2TD) × 1,04` es en la práctica un 1,04 fijo.
- Aun así, con el fee incluido, la fórmula actual `1,04 × (PMD + SC + CAP) + fee` da 1.275 € en las 5 facturas frente a 1.292 € reales (−1,3 %).
- Usar las pérdidas de ESIOS (`PMHPCB`, ≈ ×1,15) da +6,1 %. Sin curvas no se puede saber qué usa Próxima exactamente.
- **Lo que más pesa es el perfil de consumo de cada cliente.** …6282FK y …6279FH, en los mismos 4 días, pagan unos 75 €/MWh de diferencia en cada periodo, con fees que solo difieren en 4 €/MWh. En verano el mediodía es casi gratis y la tarde muy cara.
  - Sin curva, cada factura suelta se desvía entre −28 % y +30 %; en las facturas largas, entre −11 % y +7 %.
  - Ninguno de estos CUPS tiene curva Datadis cargada.

### Pérdidas reales de REE (probado el 2026-09-16)

**Dónde están.** Los ficheros `perdXXTD` (horario) y `perdqhXXTD` (cuartohorario) que nombra el contrato de Próxima van dentro de la liquidación de REE (`liquicomun`) de ESIOS:
- `archives/2` (A1): el mes en curso, en previsión;
- `archives/8` (C2): el cierre del mes anterior.

Se descargan con `download?date_type=publicacion&start_date=…&end_date=…`; si se pide por fecha de datos, responde «No values». Son un coeficiente en %.

**Resultados:**
- El 3.0TD peninsular sale entre el 13 % y el 18 % según la hora (media del 15 %, más alto de noche). Es el orden de `PMHPCB` (≈ ×1,15), no el de un 1,04.
- `prpcap30TD` (pago por capacidad del 3.0TD) da de media 0,23 €/MWh, frente a los 0,25 del `PCAPPCB` que guardamos. La diferencia es despreciable.

**Contraste con las 5 facturas.** Se compara el mercado que cobra Próxima sin el fee (1.149,68 €), con PMD y SC diarios de Supabase y media simple por periodo:

| Variante | Total | Desviación |
|---|---:|---:|
| 1,04 fijo (la actual) | 1.126,55 € | −2,0 % |
| Pérdidas de REE hora a hora × (PMD + SC + CAP) | 1.254,19 € | +9,1 % |
| La anterior con el CAP del 3.0TD | 1.254,87 € | +9,1 % |
| Pérdidas de REE × PMD, sin SC ni CAP | 1.046,30 € | −9,0 % |

**Fórmula del contrato (condiciones particulares de Cristalina):**
- `PERD = (1 + perdqh o perd de REE, en tanto por uno) × 1,04`. El 1,04 estima la diferencia entre los costes definitivos y los precios provisionales.
- `PMD`: precio de OMIE del cuarto de hora.
- `SC = PMAS1 + PMAS2 + CDSV + INT + EDSR` (PVPCDATA) `+ CCOM + CCOS` (BOE) `+ SGCE` (0).
- `CAP`: según el BOE.
- Se usa la última publicación disponible al emitir la factura.

**Qué hay en PVPCDATA:**
- Columnas del fichero completo de `liquicomun`, según el documento `modelcom` de REE: 26 SA (= PMAS1 + PMAS2 + CDSV), 27 CAP, 28 CCOS, 29 CCOM, 30 INT, 31 EDSR, 37 PMD, 41 PMAS1, 42 PMAS2 y 43 CDSV. Todas en barras de central, **sin pérdidas**.
- **El `SAHPCB` que guardamos ya lleva las pérdidas del 2.0TD.** Ejemplo del 12/08/2026 a la hora 1: SA 9,57 → SAHPCB 11,16 (× 1,166). Pasa lo mismo con FOM y FOS.
- Nuestro SC es, por tanto, «SC × pérdidas del 2.0TD», y encima se multiplica por el PERD.
- SC del contrato sin pérdidas, del 16/07 al 31/08: media de 19,01 €/MWh. El que guardamos: 22,24 (julio) y 21,74 (agosto).

**Contraste con la fórmula del contrato.** Pérdidas `perd30TD` hora a hora, SC de las columnas anteriores y CAP `prpcap30TD`, con media simple por periodo:

| Variante | Total | Desviación |
|---|---:|---:|
| Contrato completo (× 1,04) | 1.282,60 € | +11,6 % |
| Contrato sin el 1,04 | 1.233,27 € | +7,3 % |

**Limitaciones de este contraste:**
- Las facturas se emitieron el 05/08 (julio) y el 04/09 (agosto), antes de que se publicara el C2 de esos meses (11/08 y 09/09). Próxima usó, por tanto, el A1. ESIOS solo sirve el A1 del mes en curso, así que el de julio y agosto ya no se puede descargar; se ha usado el C2.
- Sin curva de consumo, la media por periodo es simple. Hay que ponderarla por la curva cuartohoraria de cada cliente.

**Respuestas de Jonathan (2026-09-16):**
- El fee del asesor se suma tal cual al precio de «Mercado»; no se multiplica por las pérdidas.
- En sus contratos no aplica fee de potencia.
- CAP: el que fija el BOE. El fichero `prpcap30TD` de REE es ese valor por tarifa y hora.
- Si el A1 de julio y agosto está publicado en algún sitio, lo revisa él.
- …6282FK y …6279FH son almacenes. Intentará conseguir su curva por Datadis.
- En cuanto haya un cliente de Próxima con curva Datadis, lo pasa para cerrar la fórmula.

**Estado.** No se cambia nada en el código hasta contrastarlo con una curva real.

## Decisión

1. **Peajes y cargos 2026, de energía y de potencia,** de las dos normas del BOE en `src/lib/market-rates.ts` y en `core/fuentes_mercado.py` del Python.
   - En potencia los totales ya eran correctos (3.0TD cuadra con las facturas: 0,055827 / 0,029089 / … / 0,003952 €/kW·día), pero estaban redondeados, y en 2.0TD y 6.1TD todo iba como peaje. Ahora llevan el reparto exacto.
   - `core/parsers/parser_factorenergia.py` tenía su propia copia antigua (en potencia, P6 = 0,62). Ahora importa las tablas de `fuentes_mercado.py`: una sola fuente.
2. **FNEE y bono social** con los valores de agosto de 2026 en `PROXIMA_CRISTALINA` (web) y en `config/settings.py` y `core/motor_calculo.py` (Python).
3. **Web (`simIndexada`):**
   - la gestión de Próxima (7 €/MWh) se suma a los otros costes y queda fuera de la base del IEE;
   - las tasas pasan a calcularse sobre mercado + fee + FNEE + GO + bono;
   - la fila del dashboard y del PDF se llama «Otros costes (FNEE, GO, bono, tasas, gestión)».
4. **Python (`MotorCalculo`):**
   - se quita la doble suma de otros costes;
   - las tasas pasan a calcularse sobre mercado + FNEE + GO + bono.
5. **El PERD se deja en 1,04 como calibración,** no como dato de ESIOS, hasta poder contrastarlo con la curva de un cliente.

## Comprobación

- **Web:** con el mercado de cada periodo fijado al que cobró Próxima, `simIndexada` da el total de las 5 facturas (sin los excesos de potencia, que no se simulan) con estas diferencias:

  | Factura | Diferencia | Motivo |
  |---|---:|---|
  | …6838JH agosto | −0,04 € | |
  | …6279FH | −0,04 € | |
  | …6282FK | −0,16 € | |
  | …6838JH julio | +1,25 € | FNEE y bono de julio, distintos |
  | …3532WJ | −1,16 € | un exceso de potencia no incluido |

  `tsc --noEmit` sin errores.
- **Python:** con las facturas originales de junio, la indexada 3.0TD baja entre 5 y 65 € por factura (sobre todo por la doble suma) y la 2.0TD sube 12,88 € (cargos reales de la punta). El agente se reinició con el código nuevo.

## Consecuencias

- El validador de facturas (`lib/validador-factura.ts`) usa las mismas tablas de peajes y cargos, así que también mejora, sobre todo en 2.0TD.
- **Pendiente para cerrar el término de mercado:** una factura de Próxima de un cliente con curva Datadis. Con ella se podrá fijar si Próxima pondera por la curva cuartohoraria, si usa pérdidas reales y si incluye `CCVPCB`.
- FNEE y bono social cambian con las órdenes del año. Revisarlos con cada factura nueva de Próxima.
- Peajes y cargos son iguales para todas las comercializadoras: cada enero se actualizan en `market-rates.ts` (web) y `fuentes_mercado.py` (Python), y en ningún otro sitio.
