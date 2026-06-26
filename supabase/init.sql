-- EnergIA — Supabase initialization SQL
-- Run this in Supabase SQL Editor

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- LEADS  (from public comparador)
-- ─────────────────────────────────────────
create table if not exists leads (
  id                      uuid primary key default uuid_generate_v4(),
  nombre                  text not null,
  email                   text not null,
  telefono                text,
  empresa                 text,
  cups                    text,
  comercializadora        text,
  tarifa                  text,
  total_factura           numeric,
  kwh_total               numeric,
  ahorro_estimado_anual   numeric,
  kwh_anuales_sips        numeric,
  created_at              timestamptz default now(),
  estado                  text default 'nuevo'
    check (estado in ('nuevo','contactado','convertido','descartado'))
);

-- ─────────────────────────────────────────
-- CLIENTES
-- ─────────────────────────────────────────
create table if not exists clientes (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid references auth.users(id),
  nombre                text not null,
  cups                  text,
  comercializadora      text,
  tarifa                text,
  email                 text,
  telefono              text,
  movil                 text,
  empresa               text,
  nif                   text,
  direccion             text,
  cp                    text,
  poblacion             text,
  provincia             text,
  estado                text default 'prospecto'
    check (estado in ('prospecto','reunion','oferta','firmado','perdido')),
  notas                 text,
  revision_pendiente    boolean default false,
  fee_energia           numeric default 0,
  fee_potencia          numeric default 0,
  kwh_anuales           numeric default 0,
  kw_contratados        numeric default 0,
  proximo_contacto      date,
  fecha_inicio_contrato date,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clientes_updated_at
  before update on clientes
  for each row execute procedure update_updated_at();

-- ─────────────────────────────────────────
-- FACTURAS  (análisis IA — datos completos)
-- ─────────────────────────────────────────
create table if not exists facturas (
  id                        uuid primary key default uuid_generate_v4(),
  cliente_id                uuid references clientes(id) on delete cascade,
  -- Periodo facturado
  fecha_inicio              date,
  fecha_fin                 date,
  fecha_factura             date,
  dias_facturados           integer,
  -- Suministro
  cups                      text,
  comercializadora          text,
  tarifa                    text,
  potencia_contratada       numeric,
  -- Importes
  total_factura             numeric,
  kwh_total                 numeric,
  precio_medio_kwh          numeric,
  -- Ahorro estimado vs indexada
  ahorro_estimado_anual     numeric,
  ahorro_estimado_mensual   numeric,
  porcentaje_ahorro         numeric,
  -- Contexto anterior (para comparación futura)
  comercializadora_anterior text,
  tarifa_anterior           text,
  -- Fee asesor y adjuntos
  fee_aplicado              numeric,
  pdf_url                   text,
  excel_url                 text,
  created_at                timestamptz default now()
);

-- ─────────────────────────────────────────
-- CONTRATOS
-- ─────────────────────────────────────────
create table if not exists contratos (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references auth.users(id),
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
    check (estado in ('activo','pendiente','baja')),
  estado_firma          text default 'pendiente_firma'
    check (estado_firma in ('pendiente_firma','firmado','rechazado')),
  ref_comercializadora  text,
  renovacion_verificada boolean default false,
  a_cobrar              numeric,
  notas                 text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create trigger contratos_updated_at
  before update on contratos
  for each row execute procedure update_updated_at();

-- ─────────────────────────────────────────
-- ACCIONES  (log de contactos por cliente)
-- ─────────────────────────────────────────
create table if not exists acciones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  cliente_id  uuid references clientes(id) on delete cascade,
  fecha       date not null default current_date,
  hora        time,
  tipo        text not null check (tipo in ('llamada','email','reunion','visita','otro')),
  resultado   text not null default 'pendiente'
                check (resultado in ('pendiente','completado','fracaso','no_contesta')),
  notas       text,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- CONTACTOS  (formulario web público)
-- ─────────────────────────────────────────
create table if not exists contactos (
  id         uuid primary key default uuid_generate_v4(),
  nombre     text not null,
  email      text not null,
  telefono   text,
  mensaje    text not null,
  created_at timestamptz default now(),
  leido      boolean default false
);

-- ─────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────
alter table leads      enable row level security;
alter table clientes   enable row level security;
alter table facturas   enable row level security;
alter table contratos  enable row level security;
alter table acciones   enable row level security;
alter table contactos  enable row level security;

create policy "auth_all_leads"      on leads      for all using (auth.role() = 'authenticated');
create policy "auth_all_clientes"   on clientes   for all using (auth.role() = 'authenticated');
create policy "auth_all_facturas"   on facturas   for all using (auth.role() = 'authenticated');
create policy "contratos_owner"     on contratos  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "acciones_owner"      on acciones   using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "service_insert_leads" on leads     for insert with check (true);
create policy "auth_all_contactos"  on contactos  for all using (auth.role() = 'authenticated');
create policy "public_insert_contactos" on contactos for insert with check (true);

-- ─────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────
create index if not exists leads_estado_idx      on leads      (estado);
create index if not exists leads_created_idx     on leads      (created_at desc);
create index if not exists clientes_estado_idx   on clientes   (estado);
create index if not exists facturas_cliente_idx  on facturas   (cliente_id);
create index if not exists contratos_cliente_idx on contratos  (cliente_id);
create index if not exists contratos_venc_idx    on contratos  (fecha_vencimiento);
create index if not exists acciones_cliente_idx  on acciones   (cliente_id);
