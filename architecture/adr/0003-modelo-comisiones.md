# ADR-0003 — Modelo de comisiones

**Estado:** Aceptado (2026-07-25). Implementado 2026-07-26: importe automático al renovar, y columna de comisión consolidada. Pendiente: el flujo de foto + IA.

## Contexto

Hoy conviven varios conceptos parecidos bajo nombres distintos, repartidos en módulos distintos del dashboard:

- `co_energia_mwh` (en `formulas_indexadas` y `contratos`) — usado por el validador de facturas para saber qué precio es correcto cobrarle al cliente en tarifas indexadas.
- `fee_energia_mwh` / `kwh_base_comision` (en `contratos`) — usado por el seguimiento de desviación de consumo (`/dashboard/comisiones`) para avisar de revisión/reclamación de comisión.
- El importe de `comisiones_generadas` — hoy se escribe a mano en el popover de "Verificar renovación" (`dashboard/contratos/page.tsx`), con `a_cobrar` del contrato como valor por defecto.

Reglas de negocio confirmadas por Jonathan (2026-07-25):
- La comisión real depende de la oferta y de la comercializadora concreta — no es un valor fijo ni universal por comercializadora, puede cambiar de un año a otro incluso con la misma.
- Existen dos márgenes distintos que acaban repercutiendo los dos en el precio que paga el cliente: el margen propio de la comercializadora (algunas lo indican, otras no — no es ingreso de Jonathan) y el CO/comisión de Jonathan (sí es su ingreso). `co_energia_mwh` se refiere siempre a este segundo, el suyo.
- El importe a facturar de una comisión **se calcula**, no se escribe a mano: fee (€/MWh) × consumo anual del cliente (MWh). Ejemplo dado: 10 €/MWh × 20 MWh/año = 200 €.
- La comisión se fija en el momento de tramitar el alta o la renovación — la comercializadora se la comunica a Jonathan (hoy, una captura/foto que pega en el chat). El objetivo es que ese dato no se teclee: se sube la foto y una IA la extrae, igual que `process-invoice` ya hace con las facturas de los clientes.
- Existe además un fee genérico (10 €/MWh energía, 0 potencia) usado solo por el comparador público para estimar ahorro a visitantes sin contrato — es un valor de marketing, no la comisión real de ningún cliente concreto, y no debe confundirse con ella.
- La facturación a las empresas intermediarias es mensual (agrupa lo generado ese mes), pero la comisión en sí se cobra una vez al año, ligada al ciclo de renovación del contrato (ver [ADR-0002](0002-ciclo-vida-contrato.md)).

## Decisión

Existe **una sola comisión real por contrato** (el CO/fee de Jonathan, en €/MWh), con un único origen de verdad, que alimenta tres consumidores distintos sin volver a teclearse en cada uno:

1. El validador de facturas (para saber qué precio es correcto cobrarle al cliente).
2. El seguimiento de desviación de consumo (para avisar de revisión/reclamación).
3. El cálculo automático del importe en `comisiones_generadas` al verificar una renovación o alta: `importe = fee_energia_mwh × kwh_anuales`, no un campo de texto libre.

El margen propio de la comercializadora es un dato de contexto (para explicar el margen de error del validador), no una comisión de Jonathan — no se modela como ingreso.

El fee genérico del comparador público (10 €/MWh) queda fuera de este modelo: es una estimación de marketing para visitantes sin contrato, independiente de la comisión real de cualquier cliente firmado.

Flujo objetivo: al tramitar alta o renovación, se sube la foto/captura de la comisión que manda la comercializadora → una IA extrae fee €/MWh (y potencia, si aplica), vigencia y producto → ese dato único queda guardado en el contrato y alimenta los tres consumidores de arriba.

## Consecuencias

**A favor:**
- Una sola fuente de verdad para la comisión real de cada contrato, en vez de tres campos que se pueden desincronizar.
- El importe a facturar deja de depender de que alguien lo escriba bien a mano — se deriva de fee × consumo.
- Reutiliza un patrón ya construido y probado (`process-invoice`) en vez de inventar uno nuevo para las comisiones.

**Trabajo pendiente que esto implica:**
- Construir el flujo de subida de foto + extracción por IA de la comisión (análogo a `process-invoice`).
- ~~Decidir y consolidar el nombre/columna única para esta comisión.~~ Hecho 2026-07-26, con datos reales delante (174 contratos): `co_energia_mwh` no se usaba nunca (0 rellenos) — retirada. `fee_energia_mwh` tenía un valor por defecto (5) que 173 de 174 contratos arrastraban sin haberlo tocado nunca — se quitó el default y se limpiaron esos 173 a `null` (migración `consolidar_comision_contrato.sql`). El validador (`validador-factura.ts`) pasa a leer `fee_energia_mwh` como override por contrato en vez de `co_energia_mwh`. **Ojo:** 4 de los 5 contratos con Próxima tramitados en julio 2026 quedaron con `fee_energia_mwh = null` tras la limpieza (nunca tuvieron un valor real, solo el placeholder) — pendiente de que Jonathan los rellene con el fee real: `CDAD PROP GARAJES Y TRASTEROS...ERANDIO`, `BAR RESTAURANTE LOS PICUDOS SL` (3 contratos). El quinto (Antonio Canales García, 18 €/MWh) ya estaba bien y no se tocó.
- ~~Cambiar el popover de "Verificar renovación" para calcular el importe automáticamente en vez de pedirlo escrito.~~ Hecho 2026-07-26: `calcularImporteComision()` en `dashboard/contratos/page.tsx` — `importe = kwh_base_comision × fee_energia_mwh / 1000 × reparto_energia`, misma fórmula ya validada en `/dashboard/comisiones` (columna "reclamable"). Descubrimiento al implementar: la fórmula real también depende de `reparto_energia` (1.00 Próxima, 0.95 Atulado), un factor que no estaba recogido en la decisión original de este ADR. Si el contrato no tiene `kwh_base_comision`/`fee_energia_mwh` rellenos, el campo sigue siendo editable a mano (fallback a `a_cobrar`) — no se fuerza a rellenar esos datos antes de poder renovar.
