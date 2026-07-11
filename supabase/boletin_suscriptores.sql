-- Suscriptores del boletín semanal del mercado (público, alta desde la web).
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (proyecto ywczhregnwbdmnffhbvi).

create table if not exists public.boletin_suscriptores (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  activo      boolean not null default true,
  token       uuid not null default gen_random_uuid(), -- para el enlace de baja
  fecha_alta  timestamptz not null default now(),
  fecha_baja  timestamptz
);

-- RLS activado SIN políticas: nadie accede con la clave anon; solo el
-- service_role (que la salta) desde los endpoints del servidor.
alter table public.boletin_suscriptores enable row level security;

-- Mismo GRANT explícito que necesitaron las demás tablas (ver fix_supabase.sql)
grant select, insert, update on public.boletin_suscriptores to service_role;
