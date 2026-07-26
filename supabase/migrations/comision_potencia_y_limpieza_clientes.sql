-- Migración: comisión por potencia a nivel de contrato (ADR-0003) + retirada
-- de los campos de comisión duplicados en clientes. Ejecutar en Supabase SQL
-- Editor.
--
-- Auditoría real 2026-07-26 (346 clientes): clientes.fee_potencia (0
-- rellenos) y clientes.kw_contratados (0 rellenos) no aportaban nada al
-- cálculo — dashboard/cartera mostraba "Comisión mensual/anual total" cerca
-- de 0 € para toda la cartera, un KPI visible pero engañoso, porque usaba un
-- modelo distinto al de contratos (el real, ya consolidado). Confirmado por
-- Jonathan: la comisión por potencia SÍ es real (normalmente no se pacta,
-- pero la opción debe existir) — se mueve al nivel correcto (contrato, igual
-- que fee_energia_mwh), no se elimina el concepto.
--
-- clientes.fee_energia tenía un único valor real (20, en CDAD PROP DE
-- GARAJES Y TRASTEROS 3-4-5-6 DE ENEKURIBIDEA EN ERANDIO) — confirmado por
-- Jonathan como el fee correcto de su contrato nuevo de Próxima (pendiente
-- de rellenar desde el ADR-0003), se traslada ahí en vez de perderse.
--
-- clientes.kw_contratados NO se toca: tiene un uso real distinto (potencia
-- contratada vs. demanda real medida por Datadis, en la ficha del cliente),
-- no es un campo de comisión duplicado.

-- ── 1. Potencia a nivel de contrato (opcional, igual patrón que energía) ────
alter table contratos add column if not exists kw_base_comision numeric;
alter table contratos add column if not exists fee_potencia_mwh numeric;

comment on column contratos.kw_base_comision is 'kW contratados que la comercializadora reportó al calcular la comisión inicial (opcional, normalmente no se pacta comisión por potencia)';
comment on column contratos.fee_potencia_mwh is 'Fee de potencia en €/kW pactado en este contrato (opcional)';

-- ── 2. Trasladar el único valor real de clientes.fee_energia ────────────────
update contratos set fee_energia_mwh = 20
 where id = '2f7fae23-c96d-4a26-8080-7eb2acd3157c';

-- ── 3. Retirar los campos duplicados/sin uso de clientes ─────────────────────
alter table clientes drop column if exists fee_energia;
alter table clientes drop column if exists fee_potencia;
