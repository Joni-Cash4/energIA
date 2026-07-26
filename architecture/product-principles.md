# Product Principles — IAenergía

No describe cómo funciona el software. Describe cómo se toman las decisiones de producto. Sirve de criterio común para evaluar cualquier funcionalidad nueva, tanto para Jonathan como para quien programe (Claude u otro). Se actualiza solo cuando cambie un criterio real de negocio, no con cada funcionalidad nueva.

## 1. Transparencia sobre certeza — nunca inventar un hallazgo

Solo se marca como error algo que se puede demostrar con datos. Si hay ambigüedad, el sistema dice "no verificable" o "revisar" en vez de arriesgarse a acusar en falso a una comercializadora.

- Una desviación a favor del cliente (le cobran de menos) nunca se reclama — reclamarlo solo provocaría una rectificativa al alza para el cliente.
- Si hay más de una fórmula/anexo candidato para una factura y no se puede saber con certeza cuál aplica, no se aplica ninguno.
- Se usa siempre el dato más real disponible. Las aproximaciones actuales (ej. precio de mercado como media del periodo en vez de ponderado por el consumo real hora a hora) son una limitación de **hoy**, por falta de datos — no una decisión definitiva. Se mejora la precisión en cuanto se disponga de más datos (ej. autorización Datadis del cliente para la curva real de consumo).

## 2. Todo lo nuevo se construye de forma aditiva

Nunca se toca ni se mueve lo que ya funciona en producción para añadir algo nuevo — ni el pipeline sincronizado con el ordenador de mesa, ni ningún módulo del dashboard ya operativo. Un cambio necesario sobre algo existente se hace de forma explícita y verificada, nunca como efecto colateral de una funcionalidad nueva.

## 3. Independencia editorial

El contenido propio (boletín de mercado, análisis, etc.) usa solo datos públicos oficiales (REE/OMIE/CNMC) y nunca menciona comercializadoras concretas — para mantener la independencia que la web promete a sus visitantes ("analizamos todas las compañías, no somos comercializadora").

## 4. Solo lo real, nunca lo inventado

Los testimonios y casos reales de la web son siempre clientes reales verificados. Nunca ejemplos ficticios, nunca fotos de stock o de prensa — solo fotos propias del cliente, con consentimiento.

## 5. Copiloto, no CRM

Un CRM almacena información. El objetivo de IAenergía es que el sistema **trabaje para el asesor**: revisar continuamente la cartera, detectar oportunidades y riesgos antes de que el asesor los busque, y decirle cada mañana dónde centrar el tiempo — no ser un sitio donde ir a buscar datos.

En la práctica, esto significa **unificar en una sola vista priorizada** las señales que ya calculan los módulos existentes (renovaciones próximas, comisiones pendientes de revisar/reclamar, facturas con anomalías del validador, oportunidades de ahorro nuevas) en vez de construir un "motor de IA" nuevo y separado. El objetivo final: que un asesor pueda gestionar una cartera grande casi solo, porque el sistema reduce al mínimo el trabajo manual de buscar qué merece atención.

Cualquier automatización nueva se mide contra esto: **¿hace que el asesor tenga que pensar menos, tarde menos, o aporte más valor al cliente?** Y contra el principio 2 (desarrollo aditivo) y el 1 (nunca actuar sin certeza): "trabajar de forma continua" no significa sin límite ni criterio — el coste y la frecuencia de cualquier proceso automático (llamadas a IA, a APIs externas) se diseñan con la misma disciplina de uso responsable que ya aplicamos a ESIOS (ver [ADR-0005](adr/0005-datos-mercado-desde-esios.md)).

## 6. Migraciones de datos históricos: exactitud antes que automatización

Cuando una migración toca datos históricos del negocio (clientes, contratos, facturas — no catálogos técnicos), la corrección importa más que la velocidad. Si el volumen es pequeño, se revisa y confirma a mano en vez de aplicar una regla automática que podría dejar un registro mal enlazado — y cuando aparece un caso especial (una inconsistencia real en los datos, no un error de modelado), se documenta explícitamente en la propia fila (ej. una columna `notas`), no solo en el ADR o el mensaje de commit, para que quede trazable dentro de la propia base de datos.

Ejemplo real: al enlazar las 7 facturas archivadas a su contrato (ver [ADR-0001](adr/0001-cups-como-entidad.md)), la asignación se propuso cruzando cliente + CUPS + fechas, pero se verificó fila por fila a mano antes de aplicarla.
