-- Verificación de prefactura para comisiones_generadas: mismo concepto que
-- ya existe en comision_cobros, pero para empresas pagadoras que no
-- fraccionan el pago (ej. Gaolania/Gana Energía) — su comisión vive
-- directamente en comisiones_generadas, no en comision_cobros (esa tabla es
-- específica del fraccionamiento de Próxima). No toca `facturado`: verificar
-- la prefactura y facturar siguen siendo dos pasos distintos y manuales.
alter table comisiones_generadas
  add column if not exists verificado_prefactura boolean not null default false,
  add column if not exists prefactura_num text,
  add column if not exists prefactura_importe numeric(10,2),
  add column if not exists prefactura_evidencia_url text,
  add column if not exists verificado_en timestamptz;

create index if not exists comisiones_generadas_verificado_idx on comisiones_generadas (verificado_prefactura);
