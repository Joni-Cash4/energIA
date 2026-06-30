-- Migración: seguimiento de comisiones por contrato
-- Ejecutar en Supabase SQL Editor

alter table contratos add column if not exists kwh_base_comision numeric;        -- kWh que usó la comercializadora al firmar
alter table contratos add column if not exists fee_energia_mwh   numeric default 5;  -- €/MWh fee pactado
alter table contratos add column if not exists reparto_energia    numeric default 1.00; -- 1.00=Próxima, 0.95=Atulado

comment on column contratos.kwh_base_comision is 'kWh anuales que la comercializadora reportó al calcular la comisión inicial';
comment on column contratos.fee_energia_mwh   is 'Fee de energía en €/MWh aplicado a este contrato';
comment on column contratos.reparto_energia   is 'Porcentaje de reparto energía: 1.00=Próxima, 0.95=Atulado';
