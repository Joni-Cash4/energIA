-- Migración: falta el grant de DELETE en mercado_sc_cap (mismo patrón de bug
-- recurrente que facturas_grants.sql / comisiones_generadas_grants.sql).
-- mercado_real_mensual.sql solo concedió select/insert/update a service_role.
-- Ejecutar en Supabase SQL Editor.

grant delete on public.mercado_sc_cap to service_role;
