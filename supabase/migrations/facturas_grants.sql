-- Migración: grants que faltaban en la tabla facturas
-- Ejecutar en Supabase SQL Editor
--
-- facturas se creó en init.sql (antes de que este proyecto adoptara el
-- patrón de dar "grant ... to authenticated" explícito en cada migración
-- nueva, como sí tienen contratos/gestiones/cliente_adjuntos). Se quedó sin
-- el grant a nivel de tabla, así que aunque la política RLS "auth_all_facturas"
-- / "facturas_owner" fuera correcta, Postgres rechazaba cualquier insert/select
-- con "permission denied for table facturas" antes de llegar a evaluar RLS.

grant select, insert, update, delete on facturas to authenticated;
