-- Migración: CO (margen del agente) en las tarifas indexadas.
-- Ejecutar en Supabase SQL Editor DESPUÉS de formulas_indexadas.sql.
--
-- El anexo de TotalEnergies deja el campo "CO Electricidad" en blanco en el
-- papel, pero el CO sí se aplica: para JAZZ TE5 son 23 €/MWh. Sin contarlo, el
-- validador daría por "cobrado de más" justo ese importe (en una factura de
-- 2.980 kWh son 68,54 €), acusando a la comercializadora de un error inexistente.
--
-- Se guarda a dos niveles porque el CO se negocia por contrato:
--   formulas_indexadas.co_eur_mwh  = valor por defecto del producto
--   contratos.co_energia_mwh       = el pactado en ese contrato concreto (manda)

alter table formulas_indexadas add column if not exists co_eur_mwh numeric not null default 0;
alter table contratos          add column if not exists co_energia_mwh numeric;

comment on column formulas_indexadas.co_eur_mwh is
  'CO / margen del agente por defecto del producto, en €/MWh sobre la energía.';
comment on column contratos.co_energia_mwh is
  'CO / margen del agente pactado en este contrato (€/MWh). Si es null se usa el del producto.';

-- CO de TotalEnergies JAZZ TE5: 23 €/MWh (dato de Jonathan, 2026-07-25)
update formulas_indexadas
   set co_eur_mwh = 23
 where match_comercializadora = 'total'
   and match_producto = 'jazz';
