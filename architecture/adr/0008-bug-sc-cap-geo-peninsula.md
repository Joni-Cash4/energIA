# ADR-0008 — Bug real: SC/CAP calculados sin filtro de geo (península)

**Estado:** Cerrado del todo (2026-07-26). Bug confirmado con datos reales, corregido en producción y en el sistema local, histórico recalculado, y auditado el impacto real sobre facturas de clientes.

## Contexto

Al investigar si `mercado_sc_cap` podía unificarse con el archivo 70 (pendiente explícito del [ADR-0006](0006-mercado-perd-desde-esios.md)), la auditoría encontró algo más grave que una oportunidad de simplificación: un bug real de datos, ya en producción.

`get_sc_por_periodo()`/`get_cap_por_periodo()` (`fuentes_mercado.py`, sistema local) calculaban SC y CAP promediando los indicadores sueltos de ESIOS (IDs 1739-1746) **sin filtrar por `geo_id`**, asumiendo (comentario en el código: "IDs verificados, sin geo_id") que esos indicadores solo devuelven un valor, el peninsular.

**Auditoría con datos reales, 2026-07-26** — se consultaron directamente los 8 indicadores (1739-1746) para una hora real:
- Solo **1739 (PMAS1)** devuelve una fila `geo_name="España"`.
- Los otros **7 indicadores (1740-1746: PMAS2, CDSV, INT, EDSR, CCOM, CCOS, CAP) no devuelven NINGUNA fila de España/península** — solo Ceuta, Melilla, Gran Canaria, Lanzarote y Fuerteventura, Tenerife, La Palma, La Gomera, El Hierro y Baleares.

El código, al hacer `media = sum(v["value"] for v in vals) / len(vals)` sin filtrar, promediaba recargos de sistemas insulares/extrapeninsulares (aislados, con costes de generación mucho más altos y regulación distinta) y los aplicaba como si fueran el SC/CAP real de un cliente peninsular.

**Magnitud confirmada** (comparando el valor guardado en `mercado_sc_cap` para junio 2026 contra el cálculo correcto desde el archivo 70, explícitamente peninsular):

| | Guardado (indicadores sin geo) | Real (archivo 70, península) | Desviación |
|---|---|---|---|
| SC | 8,76 €/MWh | 21,80 €/MWh | −60% |
| CAP | 1,34 €/MWh | 0,26 €/MWh | +415% |

Impacto real: `mercado_sc_cap` alimenta `getMercadoReal()` (`lib/market-real.ts`) → `api/process-invoice`, concretamente `sim_indexada` (simulación "cuánto costaría con Próxima Cristalina"). **Precisión importante, confirmada al auditar el impacto (ver cierre más abajo): el validador de "cobrado de más" (`lib/validador-factura.ts`) NO usa SC/CAP para clientes de TotalEnergies** — usa la fórmula propia del anexo (Di/CMFi + OMIE desnudo de `formulas_indexadas`), que el propio código ya documenta como independiente de PERD/SC/CAP. SC/CAP solo afecta a la comparativa de ahorro potencial, no a ninguna reclamación.

## Decisión (Jonathan, 2026-07-26)

1. **Método de cálculo:** sustituir los indicadores sueltos por el archivo 70 (PVPCDATA), que es explícitamente el dato peninsular (mismo usado ya para PERD en el ADR-0006, sin ambigüedad de geo):
   - `SC = SAHPCB + FOMPCB + FOSPCB + INTPCB + EDSRPCB`
   - `CAP = PCAPPCB`
2. **Datos históricos:** recalcular los meses ya guardados con el valor incorrecto (abril, mayo, junio 2026), no dejarlos así ni limitarse a corregir hacia adelante.

## Implementado

- **Producción:** `src/app/api/cron/mercado-perd-sync/route.ts` ahora calcula y guarda también `mercado_sc_cap` en la misma pasada que ya hace para `mercado_perd` — mismo mes, mismo ZIP de PVPCDATA ya descargado, **cero peticiones extra a ESIOS**. Si el mes ya existe en ambas tablas, no se llama a ESIOS (mismo principio de uso responsable del ADR-0006).
- **Sistema local:** `fuentes_mercado.py` → `get_sc_por_periodo`/`get_cap_por_periodo` (indicadores sueltos) sustituidos por `get_sc_cap_por_periodo()` (PVPCDATA, mismo patrón que `get_perd_por_periodo`). `sync_supabase_mensual.py` actualizado a la nueva firma. Así, si Jonathan vuelve a ejecutar el script local manualmente, no puede reintroducir el bug.
- **Histórico recalculado en Supabase** (`mercado_sc_cap`, verificado con lectura antes/después):

  | mes | SC antes → después (€/kWh) | CAP antes → después (€/kWh) |
  |---|---|---|
  | 2026-04 | 0,007351 → 0,029955 | 0,001195 → 0,000267 |
  | 2026-05 | 0,007522 → 0,027105 | 0,001241 → 0,000232 |
  | 2026-06 | 0,008763 → 0,021803 | 0,001340 → 0,000261 |

## Consecuencias

**A favor:**
- El validador de facturas (`process-invoice`) ya compara contra SC/CAP peninsular real, no contra recargos insulares.
- Cierra también el pendiente del ADR-0006 (unificar SC/CAP con la misma petición mensual que PERD) como efecto colateral de arreglar el bug — no se necesitó una petición nueva a ESIOS.
- El sistema local y el de producción quedan alineados en el mismo método, evitando que una ejecución manual futura reintroduzca el bug.

## Cierre — auditoría de impacto real, 2026-07-26

A petición explícita de Jonathan ("no quiero asumir que no hubo impacto"): auditoría dirigida de las facturas indexadas con periodo abril-junio 2026.

- `factura_validaciones` (histórico de reclamaciones guardadas del validador): **0 filas**, en cualquier mes — nunca se guardó una validación.
- `gestiones` con `origen='validador'`: **0 filas** — nunca se generó una reclamación desde el validador.
- Únicos candidatos donde el bug podía haber entrado en juego: facturas realmente procesadas por `api/process-invoice` con periodo abril-junio 2026. Encontrada **1** (tabla `facturas`): BAR RESTAURANTE LOS PICUDOS SL, factura de junio, procesada el 2026-07-21 (ya con el SC/CAP de junio incorrecto).

Recalculada con el SC/CAP corregido (2.919 kWh, 3.0TD): el ahorro estimado mostrado fue 182,15 €/mes con el dato incorrecto; con el dato corregido sale ~136 €/mes (~25% menos), **sin cambiar la conclusión** (Próxima seguía saliendo más barato en ambos casos). Al no haberse creado ninguna gestión ni guardado ninguna validación con ese número, no hubo ninguna decisión ni comunicación a ningún cliente basada en el dato incorrecto.

| Facturas revisadas | Afectadas | Cambia el resultado | Acción |
| ---: | ---: | ---: | --- |
| 1 | 1 | 0 | Sin impacto — nunca se guardó ni se actuó sobre ese ahorro estimado |

**Conclusión:** cero impacto real sobre clientes. El bug estuvo contenido a un número de ahorro potencial mostrado en pantalla una vez, nunca persistido ni convertido en una reclamación o comunicación. Con esto, el ADR-0008 queda cerrado sin líneas de trabajo abiertas.
