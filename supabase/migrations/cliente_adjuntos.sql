-- Migración: adjuntos por cliente (capturas de ofertas, comparativas, etc.)
-- Ejecutar en Supabase SQL Editor

-- ── 1. Bucket de almacenamiento ────────────────────────────────────────────────
-- Público como 'asesor-foto' (no como 'facturas-contrato', que es privado):
-- son capturas de tarifas/comisiones, no facturas con datos personales sensibles.
insert into storage.buckets (id, name, public)
values ('ofertas-adjuntos', 'ofertas-adjuntos', true)
on conflict (id) do nothing;

-- ── 2. Tabla ─────────────────────────────────────────────────────────────────
create table if not exists cliente_adjuntos (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  cliente_id    uuid references clientes(id) on delete cascade not null,
  contrato_id   uuid references contratos(id) on delete set null,
  nombre        text,
  tipo          text default 'imagen'
    check (tipo in ('imagen','pdf','otro')),
  url           text not null,
  storage_path  text not null,
  notas         text,
  created_at    timestamptz default now()
);

alter table cliente_adjuntos enable row level security;

create policy "cliente_adjuntos_owner" on cliente_adjuntos
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists cliente_adjuntos_cliente_idx  on cliente_adjuntos (cliente_id);
create index if not exists cliente_adjuntos_contrato_idx on cliente_adjuntos (contrato_id);

grant select, insert, update, delete on cliente_adjuntos to authenticated;

-- service_role no recibe grants automáticos en este proyecto: sin esto, el
-- endpoint /api/cliente-adjuntos/upload (usa la service role key) no puede
-- insertar aunque bypassee RLS.
grant select, insert, update, delete on cliente_adjuntos to service_role;
