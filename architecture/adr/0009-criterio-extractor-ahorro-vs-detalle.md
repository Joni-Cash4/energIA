# ADR-0009 — Criterio del extractor: ahorro fiable primero, detalle adicional cuando se pueda demostrar

**Estado:** CRITERIO APROBADO (Jonathan, 2026-08-07). Implementación pendiente (cambio mínimo + re-proceso de las 6 facturas). Factura fija real ya verificada — ver más abajo.

## Contexto

Auditoría de extracción (2026-08-07) sobre **6 facturas reales de 5 comercializadoras** (TotalEnergies indexado, Eni Plenitude, Próxima, AhorroLuz, y una factura extraordinaria de Servicios de Ajuste de TotalEnergies), comparando en cada una: **PDF original → extracción real de producción** (`claude-sonnet-4-6`, prompt actual de `process-invoice`) → clasificación correcta reconstruida a mano contra el detalle de la factura.

Hallazgo estructural, leyendo `simIndexada`/`simFija` (`process-invoice/route.ts`):

> **El ahorro = `total_factura` (real, copiado de la factura) − `sim.total`. Las simulaciones RECALCULAN energía y potencia desde cero (tablas BOE + PMD histórico). NO usan `precio_kwh`, `mercado_kwh`, `importe`, `potencia_total` ni `productos_total`.** El "Otros costes" de la factura actual que se ve en la comparativa es un **residual** (`subtotal − potencia_total − energía − reactiva − alquiler`), no un dato extraído. `productos_total` no lo consume el motor, ni el display, ni el guardado: es un **campo muerto**.

### Errores encontrados (por gravedad real, no por número)

| # | Comercializadora | Error | ¿Toca el ahorro? |
|---|---|---|---|
| 2 | TotalEnergies (Canales) | exceso de potencia (18,17 €) **fusionado en `reactiva_total`** (31,28) | **SÍ** — `reactiva_total` se arrastra a cada simulación → infla la alternativa → baja el ahorro ~18-23 € |
| 1 | TotalEnergies (Los Picudos) | exceso (139,70 €) **perdido** (ni en potencia ni en reactiva) | No — solo ensucia el desglose visual (residual "otros") |
| 6 | AhorroLuz | `mercado_kwh` = `precio_kwh` (energía all-in, no separable) | No — rompe el chequeo de peajes del validador (error falso) |
| 5 | TotalEnergies (extraordinaria SAS) | el modelo escribe prosa antes del JSON → `JSON.parse` casca | Robustez — `process-invoice` devolvería 500 |
| 4 | Próxima | otros costes + fee de gestión perdidos | No — es factura de Próxima, no se compara contra sí misma |

Patrón común: **cuando un concepto aparece como línea aislada con etiqueta que no casa con ninguna categoría, el modelo lo pierde o lo pega al de al lado** — con cualquier comercializadora. El total siempre cuadra (se copia), así que ningún chequeo de "cuadre" lo detecta.

### Reframe de negocio (Jonathan, 2026-08-07)

No necesitamos que el extractor determine si la factura es fija o indexada. El comparador solo debe responder: **coste actual → coste con nuestra alternativa → ahorro**, y funcionar igual para fijo e indexado. El desglose de "cuánto margen mete la compañía" es **información adicional**, valiosa sobre todo en indexado (mismo "producto" = pool), pero **no un requisito** para que la comparativa funcione. No añadir clasificación obligatoria fijo/indexado (no aporta y complica el extractor).

## Decisión (criterio)

**Nivel 1 — Imprescindible (el comparador):** coste actual → coste alternativa → ahorro. Funciona para fijo e indexado. Depende SOLO de:
`periodos[periodo, kwh]`, `potencias[kw]`, `tarifa`, `dias_facturados`, `dias_facturados_potencia`, `reactiva_total`, `alquiler_equipos`, `total_factura`, y los inputs de impuestos (`importe_iee`, `base_imponible`, `importe_iva`).

**Nivel 2 — Adicional (cuando los datos lo permiten):** *"estás pagando ≈ X €/MWh por encima de nuestra referencia equivalente."* Útil sobre todo en indexado. NO requisito. Es la métrica **"Diferencia de energía frente a Próxima"** ya construida (`precio_kwh − precio_kwh_nuevo`, robusta incluso en all-in porque compara todo-incluido contra todo-incluido). No hace falta demostrar cuánto es de la comercializadora y cuánto del comercial.

**Principios del extractor:**
1. Extraer bien lo que el motor necesita (Nivel 1).
2. No contaminar los campos que se arrastran a las simulaciones: `kwh`, `reactiva_total`, `alquiler_equipos`.
3. No obsesionarse con clasificar individualmente conceptos que el motor no necesita, siempre que no contaminen (2).
4. No clasificar fijo/indexado.

**Regla dura (Jonathan): el sistema NUNCA debe negarse a comparar por no saber si la factura es fija o indexada.** Si se puede calcular el coste real y el de la alternativa, la comparativa SALE. La capa de explicación (Nivel 2) tendrá más o menos detalle según la factura, pero su ausencia jamás bloquea el Nivel 1. El único "no comparable" legítimo es una factura sin consumo/periodos que comparar (p.ej. una extraordinaria de solo Servicios de Ajuste), no una ambigüedad fijo/indexado.

## Cambios propuestos, separados por impacto

### A. Afectan al MOTOR DE AHORRO (cambian el número) — 1 solo cambio real

- **`reactiva_total` debe contener SOLO reactiva.** Es el único error de toda la auditoría que mueve el ahorro. Mecanismo: sacar el exceso de potencia a un campo propio **`excesos_potencia_total`**, separado de `reactiva_total` y de `potencia_total`, con instrucción explícita de que el exceso NUNCA va a reactiva.
- **Impacto:** corrige a mejor (sube el ahorro) donde había fusión. Requiere **re-procesar las facturas con exceso + reactiva** para verificar. Riesgo bajo.
- **Decidido (Jonathan, 2026-08-07):** el exceso de potencia **NO se arrastra a la simulación de la alternativa**; solo se registra de forma independiente en `excesos_potencia_total`. No se introduce ahora un modelo de cómo se comportarían los excesos en nuestra alternativa mientras no esté definido que debamos hacerlo.

### B. Solo VALIDACIÓN / DISPLAY / ROBUSTEZ (NO tocan el ahorro)

- **Eliminar `productos_total`** (campo muerto: no lo usa motor, display ni guardado). Cero impacto en simulaciones — limpieza pura, y quita del prompt la instrucción que invita a sacar el exceso de su sitio.
- **`excesos_potencia_total`** también arregla el desglose visual: hoy el exceso perdido infla el residual "Otros costes". No cambia el ahorro.
- **Tolerancia all-in en el validador:** si `mercado_kwh` no se puede separar (fijo o all-in), no inventar un error de peajes (concepto #1).
- **Factura extraordinaria (sin periodos) → marcar "no comparable"**, no 500. Endurecer el parseo de `route.ts` para extraer el JSON aunque venga prosa delante.

**Impacto:** ninguno sobre el ahorro de las facturas normales.

## Impacto sobre lo que YA funciona

| Cambio | Bucket | Ahorro | Riesgo |
|---|---|---|---|
| `reactiva_total` solo reactiva + `excesos_potencia_total` | A | Corrige (sube) donde había fusión | Bajo — re-pasar facturas con exceso+reactiva |
| Eliminar `productos_total` | B | Cero | Ninguno |
| Tolerancia all-in validador | B | Cero | Ninguno |
| Extraordinaria → no comparable + parseo robusto | B | Cero | Bajo |

## Verificación con factura de precio fijo (hecha, 2026-08-07)

**AhorroLuz — Pastisseria Ca'n Sintes (Menorca) es una factura de PRECIO FIJO** (confirmado por Jonathan). Reconstruida a mano contra su PDF:

- Potencia 99,27 €, energía 510,04 €, reactiva 15,74 €, alquiler 12,43 €, bono 0,67 €, IEE 4,73 € (= 1 €/MWh) → base 642,88 € → total **777,88 € = al céntimo**.
- **Todos los campos de Nivel 1** (`kwh` por periodo, `potencias`, `reactiva_total`, `alquiler_equipos`, `dias`, `total_factura`, `tarifa`) se extraen correctamente → el comparador produce un ahorro válido para una factura fija.
- Único apunte: `mercado_kwh` = `precio_kwh` (energía all-in, no separable) — comportamiento esperado de una fija, es Nivel 2 y NO afecta al ahorro. Cae bajo la tolerancia all-in del cambio B.

**Conclusión:** Nivel 1 funciona con precio fijo, verificado con PDF real. El diseño no cambia por ello; la prueba solo confirma lo esperado.

## Consecuencias

**A favor:**
- El extractor se simplifica: deja de perseguir una clasificación perfecta de cada línea y se centra en no contaminar 3 campos.
- Se corrige el único error que afectaba al ahorro, y se separa claramente de los cambios cosméticos.
- `productos_total` (deuda muerta) desaparece.

**Verificación pendiente:** factura fija real + re-proceso de las facturas con exceso+reactiva tras el cambio.
