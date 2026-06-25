-- Migración: tablas CRM — contratos y acciones
-- Ejecutar en Supabase SQL Editor

-- ── 1. Ampliar clientes ──────────────────────────────────────────────────────
alter table clientes add column if not exists nif       text;
alter table clientes add column if not exists movil     text;
alter table clientes add column if not exists direccion text;
alter table clientes add column if not exists cp        text;
alter table clientes add column if not exists poblacion text;
alter table clientes add column if not exists provincia text;

-- ── 2. Contratos ─────────────────────────────────────────────────────────────
create table if not exists contratos (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid references auth.users(id) on delete cascade not null,
  cliente_id            uuid references clientes(id) on delete set null,
  cups                  text,
  comercializadora      text,
  tarifa                text,
  producto              text,
  fecha_firma           date,
  fecha_alta            date,
  fecha_vencimiento     date,
  duracion_meses        integer default 12,
  estado                text default 'activo'
    check (estado in ('activo','baja','pendiente')),
  renovacion_verificada boolean default false,
  a_cobrar              numeric(10,2),
  notas                 text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

alter table contratos enable row level security;

create policy "contratos_owner" on contratos
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists contratos_user_idx       on contratos (user_id);
create index if not exists contratos_cliente_idx    on contratos (cliente_id);
create index if not exists contratos_vencimiento_idx on contratos (fecha_vencimiento);

create trigger contratos_updated_at
  before update on contratos
  for each row execute procedure update_updated_at();

-- ── 3. Acciones (seguimiento) ─────────────────────────────────────────────────
create table if not exists acciones (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  cliente_id  uuid references clientes(id) on delete set null,
  fecha       date not null,
  hora        time,
  tipo        text default 'llamada'
    check (tipo in ('llamada','email','reunion','visita','otro')),
  resultado   text default 'pendiente'
    check (resultado in ('pendiente','completado','fracaso','no_contesta')),
  notas       text,
  created_at  timestamptz default now()
);

alter table acciones enable row level security;

create policy "acciones_owner" on acciones
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists acciones_user_idx    on acciones (user_id);
create index if not exists acciones_fecha_idx   on acciones (fecha);
create index if not exists acciones_cliente_idx on acciones (cliente_id);

-- ── 4. Permisos al rol authenticated ─────────────────────────────────────────
grant select, insert, update, delete on contratos to authenticated;
grant select, insert, update, delete on acciones  to authenticated;
