-- Guardián de accesos: registro de cada vez que alguien (Jonathan o Claude,
-- trabajando en su nombre) entra en una plataforma externa de gestión de
-- contratos (Próxima, TotalEnergies, WolfCRM AE2000...). Hoy no queda ningún
-- rastro de estas sesiones manuales.
create table if not exists accesos_plataforma (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  plataforma text not null,
  actor      text not null default 'jonathan' check (actor in ('jonathan','claude')),
  origen     text not null default 'manual' check (origen in ('manual','script')),
  nota       text,
  fecha_hora timestamptz not null default now(),
  created_at timestamptz default now()
);

alter table accesos_plataforma enable row level security;

create policy "accesos_plataforma_owner" on accesos_plataforma
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists accesos_plataforma_fecha_idx on accesos_plataforma (fecha_hora desc);

grant select, insert, update, delete on accesos_plataforma to authenticated;
grant select, insert, update, delete on accesos_plataforma to service_role;
