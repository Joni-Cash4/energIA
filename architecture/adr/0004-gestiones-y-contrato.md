# ADR-0004 — Gestiones enlazadas a contrato

**Estado:** Aceptado e implementado (2026-07-25, implementado 2026-07-26).

## Contexto

Hoy una `gestión` se liga a `cliente_id` (opcional) + `cups` (texto libre) + `compañía` (texto libre, obligatorio), sin relación con `contratos`. Si un cliente tiene varios CUPS o varios contratos históricos con distintas comercializadoras, no hay forma de saber a cuál se refiere una gestión concreta más allá de leer el texto libre.

Reglas de negocio confirmadas por Jonathan (2026-07-25):
- Prácticamente toda gestión es sobre un cliente, pero puede ser sobre alguien que todavía no es cliente (ej. un audio de Telegram sobre un problema de un futuro cliente) — `cliente_id` debe seguir siendo opcional, no forzarse.
- El resultado de resolver una gestión no siempre implica un ajuste automático en otra parte del sistema. Ejemplo dado: una factura que el cliente no puede pagar de golpe se fracciona en 3 pagos acordados con la compañía; la gestión se sigue con la fecha de próximo seguimiento y se cierra cuando se completa el último pago — es un proceso narrativo, no una corrección de factura ni de comisión.

## Decisión

Se añade `contrato_id` (opcional, `on delete set null`) a `gestiones`. Cuando existe un cliente y un contrato identificable (mismo patrón que [ADR-0001](0001-cups-como-entidad.md)/[ADR-0002](0002-ciclo-vida-contrato.md): CUPS + comercializadora + periodo), la gestión se enlaza a ese contrato concreto en vez de depender solo de los campos de texto libre `cups`/`compañía`.

Cuando no hay cliente identificado todavía (caso del futuro cliente), `cliente_id` y `contrato_id` quedan ambos en `null`, y se sigue usando `titular` (texto libre) como hoy.

No se cambia nada del ciclo de resolución: `estado`, `proximo_seguimiento`, `resolucion` y `gestion_eventos` siguen siendo suficientes — no se crea ninguna relación automática entre una gestión resuelta y `facturas` o `comisiones_generadas`.

## Consecuencias

**A favor:**
- Una gestión sobre un cliente con varios CUPS/contratos deja de depender de que el texto libre de `cups`/`compañía` esté bien escrito para saber de cuál se trata.
- No se fuerza estructura donde no la hay: el caso de un futuro cliente sigue funcionando exactamente igual que hoy.

**Implementado 2026-07-26:** migración `contrato_motivo_baja_y_gestion_contrato.sql` (columna `contrato_id` + índice), y en `dashboard/gestiones/page.tsx` un selector opcional que aparece cuando hay cliente seleccionado y ese cliente tiene contratos (lista `cups — comercializadora`). Rellenado a mano por ahora — el matching automático vía Telegram (igual que ya hace con `cliente_id`) queda pendiente si se decide en el futuro.
