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
