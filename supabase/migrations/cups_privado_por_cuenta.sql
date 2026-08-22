-- Migración: cups también privado por cuenta (decisión 2026-08-22, seguimiento
-- de privacidad_total_por_cuenta.sql). Regla de Jonathan: el CUPS pertenece a
-- la cuenta que lo introdujo; en caso de duda, a la suya.
--
-- Hoy no hace falta resolver "duda" real: la tabla cups no tiene ningún código
-- que la inserte todavía (solo se rellenó una vez, en cups_entidad_fase1.sql,
-- a partir de datos que en ese momento eran solo de Jonathan -- "Fase 2",
-- donde la app crearía/usaría cups en vivo, nunca se llegó a construir).
-- Por tanto el backfill es sencillo: todo lo existente es suyo.
--
-- Si en el futuro se construye esa Fase 2 (código que inserta en `cups`),
-- ese código DEBE fijar user_id = auth.uid() del usuario que lo crea --
-- si no, la fila queda con user_id null y no la verá nadie (ninguna política
-- de abajo cubre null).
--
-- Ejecutar en Supabase SQL Editor.

alter table cups add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists cups_user_idx on cups (user_id);

update cups set user_id = '2dd86dac-d444-4e2c-83be-ccc21cf7af80' where user_id is null;

drop policy if exists "cups_auth_all" on cups;

create policy "cups_owner" on cups
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
