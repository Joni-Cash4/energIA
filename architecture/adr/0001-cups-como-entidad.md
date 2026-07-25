# ADR-0001 — CUPS como entidad de referencia propia

**Estado:** Aceptado (2026-07-25). Decisión de diseño — no implementado todavía en código ni base de datos.

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

**Trabajo pendiente que esto implica (no hecho todavía):**
- Crear la tabla `cups`.
- Migrar los valores de texto libre existentes a referencias (`cups_id`) en las tablas que hoy usan texto.
- Cambiar `facturas` para que apunte a `contrato_id` en vez de a `cliente_id` directo.
