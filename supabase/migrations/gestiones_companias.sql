-- Migración: gestiones con comercializadoras/distribuidoras + historial de eventos
-- Ejecutar en Supabase SQL Editor

-- ── 1. Gestiones (incidencias/solicitudes con compañías) ────────────────────
create table if not exists gestiones (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid references auth.users(id) on delete cascade not null,
  cliente_id           uuid references clientes(id) on delete set null,
  titular              text,
  cups                 text,
  compania             text not null,
  tipo                 text default 'solicitamos'
    check (tipo in ('solicitamos','nos_solicitan')),
  asunto               text not null,
  via                  text default 'email'
    check (via in ('email','telefono','portal','carta','otro')),
  fecha_alta           date not null default current_date,
  proximo_seguimiento  date,
  estado               text default 'en_curso'
    check (estado in ('pendiente','en_curso','resuelto')),
  resolucion           text,
  fecha_resolucion     date,
  notas                text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

alter table gestiones enable row level security;

create policy "gestiones_owner" on gestiones
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists gestiones_user_idx        on gestiones (user_id);
create index if not exists gestiones_cliente_idx     on gestiones (cliente_id);
create index if not exists gestiones_seguimiento_idx on gestiones (proximo_seguimiento);
create index if not exists gestiones_estado_idx      on gestiones (estado);

create trigger gestiones_updated_at
  before update on gestiones
  for each row execute procedure update_updated_at();

-- ── 2. Eventos (historial de actuaciones de cada gestión) ───────────────────
create table if not exists gestion_eventos (
  id          uuid primary key default uuid_generate_v4(),
  gestion_id  uuid references gestiones(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  fecha       date not null default current_date,
  nota        text not null,
  created_at  timestamptz default now()
);

alter table gestion_eventos enable row level security;

create policy "gestion_eventos_owner" on gestion_eventos
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists gestion_eventos_gestion_idx on gestion_eventos (gestion_id);

-- ── 3. Permisos ──────────────────────────────────────────────────────────────
-- service_role no recibe grants automáticos en este proyecto: sin su grant,
-- la API con la secret key devuelve 403 (la usa el recordatorio diario).
grant select, insert, update, delete on gestiones, gestion_eventos to authenticated;
grant select, insert, update, delete on gestiones, gestion_eventos to service_role;
