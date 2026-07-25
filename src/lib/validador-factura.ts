// Validador de facturas — recalcula lo que SÍ es comprobable de forma
// determinista (peajes/cargos oficiales BOE, IVA, cuadre aritmético) y, cuando
// se conoce la fórmula exacta del contrato (producto del maestro o Próxima
// indexado), también el precio de la energía. Reutiliza los mismos cálculos
// que ya hace /api/process-invoice (sim_indexada / sim_fijas) — no duplica
// lógica de tarifas, solo compara lo ya calculado contra lo realmente facturado.
//
// Lo que NO se verifica en v1 (y se marca como tal, nunca como "error" falso):
// - Exceso de potencia real: sin curva de consumo (Datadis) no se distingue de
//   un error de facturación, así que solo se marca "revisar".
// - Precio de la energía de comercializadoras/productos que no están en el
//   maestro de tarifas ni son Próxima — se marca "no_verificable".

import { PEAJES_ENERGIA_2026, CARGOS_ENERGIA_2026, normalizaTarifa, type Periodo } from '@/lib/market-rates'
import type { InvoiceAnalysis, SimTarifa, Contrato, ConceptoValidacion, ValidacionFactura, FormulaIndexada } from '@/types'

const r2 = (n: number) => Math.round(n * 100) / 100

// Umbral para no marcar como error el ruido de redondeo/estimación: el mayor
// entre un importe fijo en € y un % sobre el importe esperado.
//
// Solo cuenta como "error" reclamable lo que te cobran DE MÁS. Una desviación a
// la baja no se reclama nunca (reclamar que te cobren de menos solo provoca una
// rectificativa al alza), pero si es grande se deja en "revisar" por si esconde
// una regularización pendiente que llegará en facturas posteriores.
function estadoPorDiferencia(diff: number, base: number, minAbs = 3, pctRel = 0.02): ConceptoValidacion['estado'] {
  const umbral = Math.max(minAbs, Math.abs(base) * pctRel)
  if (diff > umbral) return 'error'
  if (diff < -umbral) return 'revisar'
  return 'ok'
}

const NOTA_INFRACOBRO = 'Facturado por debajo de lo esperado: no es reclamable, pero puede indicar una regularización pendiente.'

function nombreProducto(comercializadora?: string, producto?: string): string {
  return `${(comercializadora ?? '').trim()} — ${(producto ?? '').trim()}`.toLowerCase()
}

export function validarFactura(
  data: InvoiceAnalysis,
  simIdx: SimTarifa,
  simsFijas: SimTarifa[],
  contrato: Pick<Contrato, 'comercializadora' | 'producto'> | null,
  formula: FormulaIndexada | null = null,
): ValidacionFactura {
  const tarifa = normalizaTarifa(data.tarifa)
  const conceptos: ConceptoValidacion[] = []
  const periodos = data.periodos ?? []

  // 1. Peajes + cargos de energía por periodo — verificable contra la tabla
  // oficial 2026 SOLO si la factura desglosa el componente de mercado. En una
  // tarifa de precio fijo ese desglose no existe (la IA devuelve 0 o null): ahí
  // el precio de la energía es un todo-en-uno del que no se pueden separar los
  // peajes, así que no se evalúa — restar un mercado de 0 daría un error falso
  // por el importe entero de la energía.
  const periodosConKwh = periodos.filter((p) => (p.kwh ?? 0) > 0)
  const conMercado = periodosConKwh.filter((p) => (p.mercado_kwh ?? 0) > 0)
  if (conMercado.length === 0) {
    conceptos.push({
      concepto: 'Peajes y cargos de energía', esperado: null, real: null, diferencia_eur: null,
      estado: 'no_verificable',
      detalle: 'La factura no desglosa el componente de mercado (habitual en precio fijo): no se pueden aislar los peajes.',
    })
  } else {
    let esperado = 0
    let real = 0
    for (const p of conMercado) {
      if (p.mercado_kwh == null) continue
      const periodo = p.periodo as Periodo
      const kwh = p.kwh ?? 0
      const oficial = (PEAJES_ENERGIA_2026[tarifa][periodo] ?? 0) + (CARGOS_ENERGIA_2026[tarifa][periodo] ?? 0)
      esperado += oficial * kwh
      real += ((p.precio_kwh ?? 0) - p.mercado_kwh) * kwh
    }
    esperado = r2(esperado); real = r2(real)
    const diff = r2(real - esperado)
    const estado = estadoPorDiferencia(diff, esperado)
    const excluidos = periodosConKwh.length - conMercado.length
    const notas = [
      excluidos > 0 ? `${excluidos} periodo(s) sin componente de mercado detectado — excluido(s) del cálculo.` : null,
      estado === 'revisar' ? NOTA_INFRACOBRO : null,
    ].filter(Boolean)
    conceptos.push({
      concepto: 'Peajes y cargos de energía', esperado, real, diferencia_eur: diff, estado,
      detalle: notas.length > 0 ? notas.join(' ') : undefined,
    })
  }

  // Producto contratado: si coincide con una tarifa del maestro conocemos sus
  // precios exactos (energía y potencia); si es Próxima indexado, la fórmula la
  // replica simIdx. En cualquier otro caso no hay referencia fiable.
  let matched: SimTarifa | null = null
  let esProxima = false
  if (contrato) {
    const objetivo = nombreProducto(contrato.comercializadora, contrato.producto)
    matched = simsFijas.find((s) => (s.nota ?? '').toLowerCase() === objetivo) ?? null
    if (!matched) {
      const com = (contrato.comercializadora ?? '').toLowerCase()
      esProxima = com.includes('proxima') || com.includes('próxima') || com.includes('cristalina')
    }
  }
  const simContratada = matched ?? (esProxima ? simIdx : null)

  // 2. Término de potencia. OJO: casi todas las comercializadoras añaden un
  // margen propio legítimo sobre los peajes/cargos regulados, así que comparar
  // contra el mínimo regulado marcaría error en casi todas las facturas. Solo
  // se evalúa si conocemos el precio de potencia del producto contratado; si no,
  // se informa del suelo regulado y se deja como no verificable.
  const realPotencia = data.potencia_total != null ? r2(data.potencia_total) : null
  const suelo = r2(simIdx.potencia) // peajes + cargos BOE, sin margen de comercializadora
  if (realPotencia == null) {
    conceptos.push({ concepto: 'Término de potencia', esperado: null, real: null, diferencia_eur: null, estado: 'no_verificable' })
  } else if (simContratada) {
    const esperado = r2(simContratada.potencia)
    const diff = r2(realPotencia - esperado)
    // Por encima de lo contratado puede ser error O exceso de potencia real
    // (superó sus kW): sin curva de consumo no se distingue → "revisar", nunca
    // "error" confirmado. Por debajo de lo contratado no perjudica al cliente.
    const estado: ConceptoValidacion['estado'] = diff > Math.max(3, esperado * 0.02) ? 'revisar' : 'ok'
    conceptos.push({
      concepto: 'Término de potencia', esperado, real: realPotencia, diferencia_eur: diff, estado,
      detalle: estado === 'revisar'
        ? 'Puede ser un error o un exceso de potencia real — no distinguible sin curva de consumo (Datadis).'
        : undefined,
    })
  } else {
    conceptos.push({
      concepto: 'Término de potencia', esperado: null, real: realPotencia, diferencia_eur: null,
      estado: 'no_verificable',
      detalle: `Peajes y cargos regulados: ${suelo.toFixed(2)} €. El resto puede ser margen legítimo de la comercializadora o un exceso de potencia.`,
    })
  }

  // 3. Precio de la energía según la tarifa contratada — solo si se conoce la
  // fórmula exacta (match en el maestro de tarifas o Próxima indexado).
  const realEnergiaTotal = r2(periodos.reduce((s, p) => s + (p.importe ?? 0), 0))
  const pmdPeriodos = data.pmd_periodos ?? {}
  const hayPmd = periodosConKwh.some((p) => (pmdPeriodos[p.periodo] ?? 0) > 0)

  if (formula && !hayPmd) {
    // Con fórmula pero sin OMIE del periodo facturado no se puede calcular nada:
    // el precio indexado es OMIE dependiente por definición.
    conceptos.push({
      concepto: 'Precio de la energía (tarifa contratada)', esperado: null, real: realEnergiaTotal,
      diferencia_eur: null, estado: 'no_verificable',
      detalle: `${formula.etiqueta}: no hay precio OMIE del periodo facturado para aplicar la fórmula.`,
    })
  } else if (formula) {
    // precio_kWh = OMIE_periodo × Di + CMFi + ATRe  (ATRe = peajes + cargos BOE)
    let esperado = 0
    const sinCoef: string[] = []
    for (const p of periodosConKwh) {
      const periodo = p.periodo as Periodo
      const kwh = p.kwh ?? 0
      const di = formula.di[periodo]
      const cmfi = formula.cmfi[periodo]
      if (di == null || cmfi == null) { sinCoef.push(periodo); continue }
      const omie = (pmdPeriodos[periodo] ?? 0) / 1000 // €/MWh → €/kWh
      const atre = (PEAJES_ENERGIA_2026[tarifa][periodo] ?? 0) + (CARGOS_ENERGIA_2026[tarifa][periodo] ?? 0)
      esperado += kwh * (omie * di + cmfi + atre)
    }
    esperado = r2(esperado)
    const diff = r2(realEnergiaTotal - esperado)
    // Guarda anti-disparate: una desviación enorme casi nunca es un error de
    // facturación, es que los coeficientes del anexo están mal cargados (el
    // CMFi se publica unas veces en €/kWh y otras en c€/kWh). Antes de acusar a
    // la comercializadora, mandar a revisar el anexo.
    const anomala = esperado > 0 && Math.abs(diff) > esperado * 0.30
    const estado: ConceptoValidacion['estado'] = anomala ? 'revisar' : estadoPorDiferencia(diff, esperado)
    const notas = [
      formula.etiqueta,
      sinCoef.length > 0 ? `Sin coeficientes para ${sinCoef.join(', ')} — excluido(s).` : null,
      anomala
        ? 'Desviación anómala: revisa los coeficientes Di/CMFi del anexo (ojo a €/kWh vs c€/kWh) antes de darla por buena.'
        : null,
      !anomala && estado === 'revisar' ? NOTA_INFRACOBRO : null,
      // Dos aproximaciones conocidas: (1) sin curva horaria del cliente usamos la
      // media aritmética del periodo en vez de ponderar por consumo; (2) el anexo
      // trunca a cero las horas de OMIE negativo y la media no. En meses de mucho
      // excedente solar esto tira el esperado hacia abajo.
      'OMIE tomado como media del periodo, sin ponderar por consumo ni truncar las horas de precio negativo: pequeño margen de error.',
    ].filter(Boolean)
    conceptos.push({
      concepto: 'Precio de la energía (tarifa contratada)', esperado, real: realEnergiaTotal,
      diferencia_eur: diff, estado, detalle: notas.join(' '),
    })
  } else if (simContratada) {
    // energia + cargo_gestion = precio final que ve el cliente, igual criterio
    // que la fila "Energia activa" del PDF comparativo. El cargo_gestion sale
    // del deslizador de honorarios: si el fee real de este cliente es otro,
    // ajústalo arriba antes de dar por buena la desviación.
    const esperado = r2(simContratada.energia + simContratada.cargo_gestion)
    const diff = r2(realEnergiaTotal - esperado)
    const estado = estadoPorDiferencia(diff, esperado)
    const notas = [
      simContratada.cargo_gestion > 0 ? 'Incluye tu fee del deslizador de honorarios.' : null,
      estado === 'revisar' ? NOTA_INFRACOBRO : null,
    ].filter(Boolean)
    conceptos.push({
      concepto: 'Precio de la energía (tarifa contratada)', esperado, real: realEnergiaTotal,
      diferencia_eur: diff, estado,
      detalle: notas.length > 0 ? notas.join(' ') : undefined,
    })
  } else {
    conceptos.push({
      concepto: 'Precio de la energía (tarifa contratada)', esperado: null, real: realEnergiaTotal,
      diferencia_eur: null, estado: 'no_verificable',
      detalle: contrato
        ? 'No se encontró la fórmula exacta de este producto en el maestro de tarifas.'
        : 'Vincula la factura a un cliente con contrato activo para poder verificarlo.',
    })
  }

  // 4. IVA aplicado — 21% general, verificable de forma independiente (a
  // diferencia del IEE, cuyo tipo efectivo varía por normativa y ya se deriva
  // de la propia factura en el simulador, no hay un % oficial fijo que asumir).
  const baseImponible = data.base_imponible ?? null
  const importeIva = data.importe_iva ?? null
  if (baseImponible != null && importeIva != null) {
    const esperado = r2(baseImponible * 0.21)
    const diff = r2(importeIva - esperado)
    conceptos.push({
      concepto: 'IVA aplicado (21%)', esperado, real: r2(importeIva), diferencia_eur: diff,
      estado: estadoPorDiferencia(diff, esperado, 1, 0.01),
    })
  } else {
    conceptos.push({ concepto: 'IVA aplicado (21%)', esperado: null, real: importeIva, diferencia_eur: null, estado: 'no_verificable' })
  }

  // 5. Cuadre del total — comprobación aritmética, siempre verificable
  if (baseImponible != null && importeIva != null && data.total_factura != null) {
    const esperado = r2(baseImponible + importeIva)
    const diff = r2(data.total_factura - esperado)
    conceptos.push({
      concepto: 'Cuadre del total facturado', esperado, real: r2(data.total_factura), diferencia_eur: diff,
      estado: estadoPorDiferencia(diff, esperado, 1, 0.005),
    })
  }

  const desviacion_total_eur = r2(
    conceptos.reduce((s, c) => s + (c.estado === 'error' ? (c.diferencia_eur ?? 0) : 0), 0)
  )

  return { conceptos, desviacion_total_eur, tiene_errores: conceptos.some((c) => c.estado === 'error') }
}
