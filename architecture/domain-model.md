# Domain Model — IAenergía

Sin SQL ni implementación. Describe el negocio: qué representa cada entidad, quién la crea, quién la modifica, qué eventos genera, y de qué otras entidades depende. Es la referencia de la que salen los ADR — se actualiza cuando el negocio cambie, no cuando cambie el código.

## Dominio Comercial

### Lead
- **Qué representa:** alguien que subió su factura al comparador público sin ser cliente todavía.
- **Quién la crea:** el propio visitante, vía el comparador público.
- **Quién la modifica:** Jonathan (cambia estado, lo asigna, lo contacta).
- **Eventos que genera:** ninguno propio; si se convierte, da lugar a un Cliente + Contrato.
- **Depende de:** nada.

### Cliente
- **Qué representa:** persona o empresa con la que Jonathan tiene o ha tenido relación comercial.
- **Quién la crea:** Jonathan (alta manual, o conversión de un Lead).
- **Quién la modifica:** Jonathan.
- **Eventos que genera:** ninguno propio — es el sujeto de Contratos, Gestiones, Acciones.
- **Depende de:** nada (puede existir sin CUPS ni Contrato — ej. un prospecto).

### CUPS — [ADR-0001](adr/0001-cups-como-entidad.md)
- **Qué representa:** el punto de suministro físico. No cambia aunque cambie el titular.
- **Quién la crea:** Jonathan, al procesar la primera factura o alta de ese punto de suministro.
- **Quién la modifica:** nadie normalmente — sus atributos son estables (dirección, tarifa de acceso).
- **Eventos que genera:** ninguno propio — es el ancla de la que cuelgan los Contratos a lo largo del tiempo.
- **Depende de:** nada.

### Contrato — [ADR-0002](adr/0002-ciclo-vida-contrato.md)
- **Qué representa:** la relación entre un CUPS, un Cliente y una Comercializadora, con vigencia y condiciones.
- **Quién la crea:** Jonathan, al tramitar un alta o al abrir uno nuevo (cambio de titular o de comercializadora).
- **Quién la modifica:** Jonathan (renovación, cambio de producto, baja).
- **Eventos que genera:** Alta, Renovación, Cambio de producto, Baja (con motivo). Cada uno puede generar una Comisión.
- **Depende de:** CUPS, Cliente, Comercializadora.

### Comparativa
- **Qué representa:** el resultado objetivo de ejecutar el motor de cálculo sobre una factura — tarifa actual vs. indexada vs. fijas (BOE/WEB). No es un módulo ("el comparador"), es el resultado que ese módulo produce.
- **Quién la crea:** el sistema (comparador público o `nueva-factura` del dashboard), a partir de una factura subida.
- **Quién la modifica:** nadie — es un resultado de cálculo en un momento dado, no algo que se edite.
- **Eventos que genera:** puede derivar en una Oferta.
- **Depende de:** una factura de entrada, y de las Tarifas/Fórmulas del dominio Mercado vigentes en ese momento.

### Oferta
- **Qué representa:** la opción que realmente se le propone y negocia con el cliente. Normalmente coincide con la mejor opción de la Comparativa, pero no siempre — un cliente puede preferir precio fijo aunque la indexada salga más barata en el cálculo (ej. por no fiarse de la variabilidad del indexado). Es la decisión comercial, no el resultado matemático.
- **Quién la crea:** Jonathan, a partir de una Comparativa.
- **Quién la modifica:** Jonathan, mientras se negocia con el cliente.
- **Eventos que genera:** si se acepta, da lugar a un Contrato.
- **Depende de:** una Comparativa.

### Comisión — [ADR-0003](adr/0003-modelo-comisiones.md)
- **Qué representa:** no es una entidad estática — es una secuencia de eventos de liquidación (alta / renovación / corrección) ligados a un Contrato, con un importe calculado a partir de un fee (€/MWh) y el consumo real del cliente.
- **Quién la crea:** Jonathan, al verificar una renovación/alta (a futuro, automáticamente al subir la foto de la comisión pactada).
- **Quién la modifica:** nadie — cada evento es un hecho cerrado; una corrección es un evento nuevo, no una edición del anterior.
- **Eventos que genera:** alimenta la facturación mensual a las empresas de pago.
- **Depende de:** Contrato, Empresa de pago.

### Gestión — [ADR-0004](adr/0004-gestiones-y-contrato.md)
- **Qué representa:** un caso o reclamación con una Comercializadora o Distribuidora.
- **Quién la crea:** Jonathan (manual, o vía el bot de Telegram por audio/texto), o el sistema (el validador de facturas, cuando detecta un cobro de más demostrable).
- **Quién la modifica:** Jonathan, a lo largo del seguimiento.
- **Eventos que genera:** eventos de seguimiento hasta su resolución.
- **Depende de:** opcionalmente de Cliente y Contrato (puede no tener ninguno si es sobre un futuro cliente).

## Dominio Energético

### Factura
- **Qué representa:** una factura real de un cliente, subida y analizada.
- **Quién la crea:** el cliente (sube el PDF) o Jonathan.
- **Quién la modifica:** nadie tras su creación — es histórico.
- **Eventos que genera:** puede disparar una Comparativa y, si hay un cobro de más demostrable, una Gestión (origen `validador`).
- **Depende de:** Contrato (hoy depende de Cliente directo — ver ADR-0001, debería depender de Contrato).

### Consumo
- **Qué representa:** el consumo real de un CUPS, mes a mes (vía Datadis o extraído de facturas).
- **Quién la crea:** la sincronización con Datadis, o la extracción de una Factura.
- **Quién la modifica:** nadie — es histórico.
- **Eventos que genera:** alimenta el seguimiento de desviación de comisión y la detección de candidatos a certificados de ahorro energético.
- **Depende de:** CUPS.

### Potencia
- **Qué representa:** la potencia contratada de un CUPS por periodo tarifario.
- **Quién la crea:** se extrae de la Factura o de Datadis.
- **Quién la modifica:** Jonathan, si cambia el contrato de potencia.
- **Eventos que genera:** ninguno propio — es un dato de referencia para Comparativas.
- **Depende de:** CUPS.

## Dominio Mercado

### Comercializadora
- **Qué representa:** la empresa eléctrica con la que Jonathan colabora como agente.
- **Quién la crea/modifica:** Jonathan (alta manual, muy poco frecuente).
- **Eventos que genera:** ninguno propio.
- **Depende de:** nada.

### Tarifa / Producto
- **Qué representa:** una tarifa fija o indexada concreta que ofrece una Comercializadora.
- **Quién la crea:** el sincronizador de anexos o Jonathan a mano.
- **Quién la modifica:** se reemplaza cuando cambia el anexo, no se edita.
- **Eventos que genera:** alimenta las Comparativas.
- **Depende de:** Comercializadora.

### Fórmula indexada
- **Qué representa:** los coeficientes (Di, CMFi, CO) de una tarifa indexada, vigentes desde la firma de un anexo concreto.
- **Quién la crea:** Jonathan, a partir del PDF del anexo (a futuro, por IA).
- **Quién la modifica:** no se edita — un cambio de anexo crea una fila nueva con su propia ventana de vigencia.
- **Eventos que genera:** alimenta el validador de facturas y las Comparativas.
- **Depende de:** Comercializadora, Producto.

### Datos de mercado (OMIE/REE)
- **Qué representa:** precios y perfiles de mercado eléctrico públicos.
- **Quién la crea:** la API pública de REE, importada automáticamente.
- **Quién la modifica:** nadie — es un dato externo.
- **Eventos que genera:** alimenta Comparativas y el boletín semanal.
- **Depende de:** nada.

## Dominio Plataforma (soporte, no negocio)

Usuarios/autenticación, automatizaciones (crons), IA (extracción de facturas/comisiones, transcripción de audio), notificaciones (email, Telegram), adjuntos, almacenamiento. Son infraestructura al servicio de las entidades de arriba, no entidades de negocio en sí mismas — el OCR/extracción por IA es un servicio, no algo que "represente" un concepto del negocio.

## Relación con los ADR

- [ADR-0001](adr/0001-cups-como-entidad.md) — CUPS
- [ADR-0002](adr/0002-ciclo-vida-contrato.md) — Contrato
- [ADR-0003](adr/0003-modelo-comisiones.md) — Comisión
- [ADR-0004](adr/0004-gestiones-y-contrato.md) — Gestión
