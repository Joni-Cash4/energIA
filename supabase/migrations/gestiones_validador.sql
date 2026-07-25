-- Migración: validador de facturas — origen 'validador' en gestiones + histórico
-- de validaciones en factura_validaciones.
-- Ejecutar en Supabase SQL Editor.

alter table gestiones drop constraint if exists gestiones_origen_check;
alter table gestiones add constraint gestiones_origen_check check (origen in ('manual','audio','texto','validador'));

create table if not exists factura_validaciones (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid references auth.users(id) on delete cascade not null,
  cliente_id            uuid references clientes(id) on delete set null,
  cups                  text,
  fecha_factura         date,
  desviacion_total_eur  numeric,
  detalle               jsonb not null,
  gestion_id            uuid references gestiones(id) on delete set null,
  created_at            timestamptz default now()
);

alter table factura_validaciones enable row level security;

create policy factura_validaciones_owner on factura_validaciones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- service_role no recibe grants automáticos en este proyecto: sin este grant
-- explícito, cualquier acceso con la secret key devolvería 403 (ver
-- gestiones_companias.sql / facturas_grants.sql para el mismo patrón).
grant select, insert, update, delete on factura_validaciones to authenticated;
grant select, insert, update, delete on factura_validaciones to service_role;
