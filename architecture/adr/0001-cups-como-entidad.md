# ADR-0001 — CUPS como entidad de referencia propia

**Estado:** Aceptado (2026-07-25). Fase 1 implementada 2026-07-26 (tabla `cups` + `cups_id` opcional, 100% aditiva). Fase 2 parcialmente implementada el mismo día: panel "Histórico de este punto de suministro" en la ficha del cliente. Pendiente: migrar `facturas` a `contrato_id`.

## Contexto

Hoy `cups` es un campo de texto libre, repetido de forma independiente en `leads`, `clientes`, `contratos`, `facturas`, `consumos_datadis` y `potencia_datadis`. No hay ninguna tabla ni clave foránea que los relacione entre sí — dos filas con el mismo CUPS solo coinciden si el texto está escrito exactamente igual en ambas.

Reglas de negocio confirmadas por Jonathan (2026-07-25):
- Un cliente puede tener varios CUPS a la vez.
- Un CUPS puede cambiar de titular (compra, alquiler, traspaso del negocio) — poco frecuente, sobre todo en hostelería. Un mismo CUPS no suele cambiar de titular muchas veces.
- Puede haber cientos de facturas guardadas por CUPS a lo largo del tiempo, incluso de comercializadoras distintas.
- El histórico completo de un CUPS (aunque haya cambiado de titular) es importante de mantener consultable.
- Las comisiones son siempre por CUPS/contrato individual, nunca agregadas por cliente — un cliente con 3 CUPS genera 3 comisiones independientes. Esto ya está bien modelado en el código real (`comisiones_generadas.contrato_id`).

## Decisión

`CUPS` pasa a ser una entidad de referencia propia (tabla `cups`, con los atributos físicos estables del punto de suministro: dirección, tarifa de acceso, etc. — datos que no cambian aunque cambie el titular). El resto de tablas (`contratos`, `facturas`, `consumos_datadis`, `potencia_datadis`, `leads`) referencian esa tabla por clave foránea en vez de repetir el texto.

Un cambio de titular **no modifica el contrato existente**: se abre un contrato nuevo que referencia el mismo CUPS con el cliente nuevo. El contrato anterior queda congelado como histórico, con su titular y comercializadora de entonces intactos. Ver [ADR-0002](0002-ciclo-vida-contrato.md) para el detalle completo del ciclo de vida del contrato, incluido el mismo patrón aplicado a un cambio de comercializadora.

`facturas` debería colgar de `contrato_id` en vez de `cliente_id` directo, para que una factura quede ligada de forma permanente al titular y comercializadora que eran correctos en el momento en que se generó, incluso si el CUPS cambia de manos después.

## Consecuencias

**A favor:**
- El histórico completo de un CUPS (contratos, facturas, consumos) queda consultable de forma fiable, cruzando por clave foránea en vez de por coincidencia de texto.
- Se elimina el riesgo de que un error de tecleo o una diferencia de formato rompa silenciosamente una búsqueda histórica.
- Las comisiones y facturas ya pueden colgar del contrato/CUPS correcto de forma consistente en todo el sistema.

**Trabajo pendiente:**
- Cambiar `facturas` para que apunte a `contrato_id` en vez de a `cliente_id` directo.
- ~~Fase 2: hacer que el código use `cups_id` de verdad~~ Hecho 2026-07-26 en parte: `dashboard/clientes/[id]/page.tsx` muestra un panel "Histórico de este punto de suministro" con los demás titulares que ha tenido el mismo CUPS (`contratos.cups_id`), solo si hay alguno — no añade ruido en el caso normal de un CUPS con un único titular.
- ~~Crear la tabla `cups`.~~ ~~Migrar los valores de texto libre existentes a referencias (`cups_id`).~~ Hecho 2026-07-26, Fase 1 (migración `cups_entidad_fase1.sql`), 100% aditiva — no cambia el comportamiento de la web todavía, solo deja `cups_id` poblado y listo.

**Hallazgos de la auditoría real (2026-07-26, 346 clientes / 174 contratos) antes de migrar:**
- 37 CUPS en `clientes` compartidos por 2+ titulares distintos, todos con contrato "firmado" — confirma que el problema es real y con volumen, no un caso raro de hostelería. Ejemplo real: un CUPS con 4 titulares distintos a lo largo del tiempo.
- Sin problemas de mayúsculas/espacios en los datos — simplificó la migración.
- Un código (`ES002100003285478HV`) tiene 19 caracteres en vez de los 20 habituales — probable error de tecleo, importado tal cual sin adivinar el valor correcto. Pendiente de que Jonathan lo corrija a mano en la tabla `cups` cuando sepa el código real.
- Un CUPS (`...822029MZ`) aparece en dos fichas de cliente: una es el caso real de "Casos reales" (Mariano Gómez Pérez), la otra es un registro cuyo *nombre* es literalmente ese CUPS, estado "prospecto" — parece un duplicado huérfano del comparador público, no un caso real de cambio de titular. No se ha tocado, pendiente de revisión/limpieza por Jonathan.
