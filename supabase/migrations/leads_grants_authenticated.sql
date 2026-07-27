-- Migración: grant que faltaba en leads para el rol authenticated.
-- Ejecutar en Supabase SQL Editor.
--
-- leads se creó en init.sql, igual que facturas (ver facturas_grants.sql) --
-- de antes de que este proyecto adoptara el patrón de dar "grant ... to
-- authenticated" explícito en cada migración nueva (contratos/gestiones/
-- cliente_adjuntos sí lo tienen). Confirmado con datos reales 2026-07-27:
-- el INSERT anónimo ya funciona (grants_anon_leads_contactos.sql), hay filas
-- reales en la tabla, pero /dashboard/leads las muestra vacío -- Postgres
-- rechaza el SELECT de Jonathan (rol authenticated) antes de evaluar la
-- política RLS "leads_read", que ya era correcta.

grant select, insert, update, delete on public.leads to authenticated;
