-- Migración: grant que faltaba en comisiones_generadas (mismo patrón de bug
-- recurrente que facturas_grants.sql / gestiones_companias.sql). Sin este
-- grant, service_role no puede leer/escribir la tabla aunque las políticas
-- RLS sean correctas — Postgres rechaza antes de llegar a evaluar RLS.
-- Ejecutar en Supabase SQL Editor.

grant select, insert, update, delete on public.comisiones_generadas to service_role;
