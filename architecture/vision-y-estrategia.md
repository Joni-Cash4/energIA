# Visión y modelo de decisión — IAenergía

Sin código ni implementación. Describe qué es IAenergía de fondo y cómo debería tomar (o ayudar a tomar) decisiones sobre la cartera — no cómo funciona el software hoy. Se actualiza cuando cambie la estrategia real del despacho o el criterio de Jonathan, no con cada funcionalidad nueva. Complementa a [domain-model.md](domain-model.md) (qué son las entidades) y a [product-principles.md](product-principles.md) (cómo se deciden features) sin repetirlos.

## Qué es IAenergía

IAenergía no es el comparador, ni el CRM, ni el simulador de tarifas — esas son herramientas, y cualquiera puede construir una versión de cada una por separado. IAenergía es el sistema que las une para multiplicar la capacidad de un asesor energético: que Jonathan pueda gestionar cientos o miles de contratos manteniendo la calidad de análisis y seguimiento que tendría si solo llevara 30 clientes.

> IAenergía es un copiloto inteligente para asesores energéticos que analiza continuamente toda la cartera, detecta oportunidades y riesgos antes que nadie, y ayuda al asesor a tomar mejores decisiones — sin sustituir nunca su criterio.

El activo defendible no es ninguna herramienta suelta. Es convertir el criterio de un asesor con experiencia en algo que el sistema puede aplicar con consistencia perfecta a una cartera grande — algo que el propio asesor, a mano, no puede sostener sin fatiga ni deriva según crece el volumen.

## Las cinco capas

1. **Captación** — todo lo que hace que lleguen oportunidades: comparador público, web, SEO, LinkedIn, boletín. Objetivo: conseguir leads. *(Construida — es la web pública `iaenergia.es`.)*
2. **Operación** — gestión de clientes, contratos, gestiones, agenda, documentación, facturas, comisiones, renovaciones. Objetivo: que no se pierda nada. *(Construida — es el dashboard actual.)*
3. **Inteligencia** — cruza continuamente los datos de Operación + mercado y genera señales objetivas: "este contrato merece revisarse", "esta factura tiene una anomalía", "este contrato va a provocar una retrocomisión". No decide nada — solo encuentra oportunidades y riesgos que hoy dependen de que Jonathan se acuerde de mirar el módulo correcto. *(Parcialmente construida: el motor de simulación, el validador de facturas y el seguimiento de desviación de consumo ya generan señales, cada uno en su propia página del dashboard. Falta unificarlas en un solo feed — ver product-principles.md #5, ya anticipado antes de esta sesión.)*
4. **Estrategia** — aplica el criterio real del despacho sobre las señales de Inteligencia para responder "¿qué haría Jonathan aquí?". No son reglas fijas en el código ni algo que el sistema infiere o ajusta solo con el tiempo: son reglas explícitas y versionadas que Jonathan edita cuando su criterio cambia. *(No construida todavía — hoy este criterio vive solo en la cabeza de Jonathan. Ver la primera versión más abajo.)*
5. **Decisión** — pertenece siempre al asesor. El sistema nunca ejecuta una acción irreversible (cambiar de comercializadora, romper un contrato) sin confirmación explícita. *(Ya es el patrón aplicado en `comision-foto/upload`: la IA propone, el asesor confirma — ver [ADR-0003](adr/0003-modelo-comisiones.md).)*

Cómo se alimentan entre sí: Captación entrega leads a Operación (un lead convertido se vuelve cliente + contrato). Operación es la materia prima de Inteligencia. Inteligencia entrega señales a Estrategia, que las prioriza con el criterio del despacho. Estrategia le presenta a Jonathan una recomendación razonada — nunca ya ejecutada — para que la capa de Decisión actúe. La acción tomada vuelve a Operación como nuevo dato; si Jonathan aprende algo que cambia su criterio, la actualización va a Estrategia como una edición explícita suya, nunca como un ajuste automático del sistema.

## Primera versión de las reglas de Estrategia

Extraídas el 2026-07-27, en una entrevista directa con Jonathan (no auditando código). Es la primera vez que este criterio se hace explícito — **nada de esto está construido en software todavía.**

### Cliente nuevo vs. cliente en cartera
Un lead nuevo se trabaja para conversión total. Un cliente ya en cartera es una decisión distinta: buscar oportunidad siempre, pero valorando si compensa a los dos lados (cliente y despacho), no solo si hay ahorro técnico.

### Regla por defecto en cartera: no revisar a mitad de contrato
Por defecto, un contrato en cartera no se reevalúa hasta su fecha de renovación. Moverlo antes tiene un coste real: la retrocomisión (proporcional al tiempo restante del contrato, ver [ADR-0003](adr/0003-modelo-comisiones.md)) y el desgaste de confianza con la comercializadora. En la renovación, sin ese coste de por medio, cualquier diferencia real a favor de otra opción se valora sin necesitar un listón alto.

### Cuándo se rompe esa regla
El ahorro que justifica mover a un cliente a mitad de contrato no es un € ni un % fijo — es relativo al tamaño de su factura. 300€/año es determinante en un cliente de ~100€/mes; en uno de ~1000€/mes "hay que valorarlo", no es automático. Un 6% es el umbral blando donde Jonathan empieza a mirarlo en serio — y sabe que un 6% real es raro (porque ya renegocia en condiciones óptimas en cada renovación) salvo que la comparación esté mal hecha comparando momentos de mercado distintos.

Dato de verificación real: la retrocomisión nunca ha sido, por sí sola, la razón para descartar un cambio que el ahorro ya justificaba — frena la evaluación por defecto, no actúa como veto una vez se evalúa.

### Jerarquía de comercializadoras (tres niveles, no plana)
1. **Apuesta principal, siempre:** Próxima Energía y Atulado Energía — mismo grupo (Hidroeléctrica El Carmen), misma relación estratégica. No es lealtad abstracta: ahorro y comisión ya comparables a lo habitual, más ser de los primeros agentes de zona norte en un canal que el grupo acaba de abrir a comerciales, con margen de mejora futura si la relación funciona.
2. **Segundo nivel, reparto conocido por segmento:** Total Energies (95% para pymes), Gana Energía y Nordy (100% para hogares).
3. **Resto:** solo con oferta puntual excepcional. Si el cliente pide una de estas y no es habitual, Jonathan intenta reconducirlo hacia una de las suyas antes de aceptar sin más.

No hay lista negra por calidad/incidencias — la disposición depende solo de la oferta puntual, no de la reputación de la comercializadora.

### La única línea roja real
No es la retrocomisión ni el desgaste por churn — es perder al cliente frente a otro asesor. Si el cliente cambia de comercializadora pero sigue con Jonathan, no hay problema, ni siquiera yendo a una compañía no habitual (se reconduce, no se bloquea). Si se plantea irse con otro gestor, Jonathan hace todo lo posible por evitarlo.

### Reparto por segmento, no solo por comercializadora
Hallazgo nuevo, no modelado hoy: el % de reparto varía por comercializadora **y** por segmento de cliente (pyme vs. hogar) — `contratos.reparto_energia` hoy es un único valor por contrato, sin esa distinción.

## Qué falta para que esto sea software, no solo documento

- Unificar en un solo feed las señales que hoy ya calculan módulos aislados (validador de facturas, desviación de consumo, renovaciones próximas) — capa de Inteligencia real.
- Convertir las reglas de arriba en configuración explícita y versionada — nunca hardcodeada como verdad única, nunca "aprendida" sola — que Jonathan edite cuando su criterio cambie.
- Que toda recomendación llegue con su razonamiento visible (qué regla se aplicó y por qué), nunca como caja negra — coherente con el principio 1 de [product-principles.md](product-principles.md) (transparencia sobre certeza).

## Relación con el resto de la arquitectura

- [domain-model.md](domain-model.md) — entidades de negocio que alimentan la capa de Operación.
- [product-principles.md](product-principles.md) — principio 5 ("Copiloto, no CRM") ya anticipaba el feed unificado antes de esta sesión.
- [ADR-0003](adr/0003-modelo-comisiones.md) — mecánica exacta de la retrocomisión.
- [backlog.md](backlog.md) — ideas de patrón técnico diferidas (distinto de esto, que es visión de negocio, no patrón de código).
