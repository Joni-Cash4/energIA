# Backlog de arquitectura — IAenergía

Ideas de patrón común identificadas pero que se decide conscientemente **no** construir todavía, siguiendo el mismo criterio que en los ADR: primero aparecen dos o más casos reales, luego se extrae el patrón — nunca al revés. Se revisa esta lista cuando surge un caso nuevo que podría ser el segundo caso real de alguna idea de abajo.

## Extracciones de IA con preview + confirmación

**Idea:** modelar todas las extracciones por IA del proyecto (facturas, comisiones, tarifas...) como un flujo común con estados `pendiente` / `confirmada` / `descartada`, en vez de que cada endpoint reinvente su propio patrón de persistencia.

**Por qué no se construye ahora (decisión de Jonathan, 2026-07-27):** solo hay un caso real que necesita preview + confirmación explícita antes de escribir — `api/comision-foto/upload` (ver [ADR-0003](adr/0003-modelo-comisiones.md)). Las otras dos extracciones ya existentes tienen perfiles de riesgo distintos y no necesitan este estado:
- `process-invoice`: efímera, se usa al momento en el simulador — nunca persiste por sí sola.
- `facturas-contrato/upload`: persiste directo, pero con deduplicación por número de factura y bajo coste de error si falla.

Generalizar ahora sería diseñar la forma común a partir de un solo punto de datos real.

**Revisar cuando:** aparezca una segunda extracción de IA que también necesite preview + confirmación antes de persistir (ej. extracción automática de fórmulas indexadas de un anexo, si algún día se automatiza — ver [ADR-0007](adr/0007-tarifas-fijas-se-queda-en-excel.md)). Con dos casos reales delante se sabrá la forma común de verdad, en vez de adivinarla.

**Valor añadido, independiente de la decisión de arriba:** conservar el documento/foto origen de cada extracción de IA (ya se hace en `comision-foto` y en `facturas-contrato`, incluso las descartadas — decisión explícita de no borrarlas) tiene valor por sí solo para auditar fallos del modelo o comparar extracciones en el futuro. No depende de construir el flujo de estados.
