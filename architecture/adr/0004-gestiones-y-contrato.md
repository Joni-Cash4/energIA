# ADR-0004 — Gestiones enlazadas a contrato

**Estado:** Cerrado (2026-07-25, implementado 2026-07-26, cierre auditado 2026-07-26).

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

## Cierre del ADR — auditoría, 2026-07-26

**Hallazgo (datos reales, 7 gestiones en producción):** `contrato_id` llevaba desde el 25/26-jul sin usarse ni una sola vez (0 de 7), incluido el caso que motivó el ADR (José Antonio Peribáñez, 2 contratos, uno de ellos coincide exactamente con el `cups`/`compania` de texto libre de su gestión). El motivo real no era falta de necesidad: el 86% de las gestiones (6 de 7) se crean por Telegram (audio/texto), y ese flujo nunca intentaba resolver `contrato_id` — solo `cliente_id`. Además, una vez guardado, `contrato_id` no se mostraba en ningún sitio (ni la tabla de `/dashboard/gestiones` ni la tarjeta "Gestiones con compañías" de la ficha de cliente), así que tampoco había ocasión de notar que faltaba.

**Decisión de dominio (Jonathan, 2026-07-26):** resolver `contrato_id` mediante un servicio de dominio determinista, no mediante una decisión directa de la IA — la IA solo extrae evidencias (CUPS mencionado, comercializadora), y el backend enlaza el contrato únicamente cuando hay un único candidato compatible entre los contratos reales del cliente. Si hay ambigüedad, se deja `null`. Mismo principio ya usado en la resolución de contrato de `facturas-contrato/upload` (ADR-0001).

**Implementado:**
- `lib/gestiones.ts` → `resolverContratoGestion(contratos, evidencia)`: función pura, sin llamadas a red. Si el cliente tiene un solo contrato, lo asigna directamente (no hay ambigüedad posible). Si tiene varios, intenta CUPS exacto y, si no, comercializadora por coincidencia parcial — solo si el resultado es un único contrato.
- `api/telegram/webhook/route.ts`: el prompt de extracción ahora pide también `cups_mencionado` (evidencia, no decisión). Tras resolver `cliente_id`, se cargan los contratos de ese cliente y se llama a `resolverContratoGestion()` para fijar `contrato_id` de forma determinista antes de insertar la gestión.
- Visibilidad: `dashboard/gestiones/page.tsx` (columna "Contrato" en la tabla) y la ficha de cliente (`dashboard/clientes/[id]/page.tsx`, línea de CUPS/comercializadora bajo cada gestión) muestran ahora el contrato enlazado siempre que exista, vía `select('*, contrato:contratos(id,cups,comercializadora))'`.
- El formulario manual de creación/edición no cambia — ahí la elección la sigue haciendo Jonathan directamente, no hay IA de por medio.

**Verificado:** TypeScript compila sin errores; la ruta compila y sirve 200 sin errores de consola. No se pudo verificar visualmente con datos reales porque el dashboard exige login — pendiente de que Jonathan lo confirme al desplegar y probar con un audio de Telegram real sobre un cliente con varios contratos.
