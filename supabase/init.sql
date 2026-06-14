-- EnergIA — Supabase initialization SQL
-- Run this in Supabase SQL Editor

-- Enable UUID extension
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
  id                uuid primary key default uuid_generate_v4(),
  nombre            text not null,
  cups              text,
  comercializadora  text,
  tarifa            text,
  email             text,
  telefono          text,
  empresa           text,
  estado            text default 'prospecto'
    check (estado in ('prospecto','reunion','oferta','firmado','perdido')),
  notas             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- auto-update updated_at
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
-- FACTURAS
-- ─────────────────────────────────────────
create table if not exists facturas (
  id                      uuid primary key default uuid_generate_v4(),
  cliente_id              uuid references clientes(id) on delete cascade,
  fecha_inicio            date,
  fecha_fin               date,
  total_factura           numeric,
  kwh_total               numeric,
  ahorro_estimado_anual   numeric,
  fee_aplicado            numeric,
  pdf_url                 text,
  excel_url               text,
  created_at              timestamptz default now()
);

-- ─────────────────────────────────────────
-- CONTACTOS  (formulario web público)
-- ─────────────────────────────────────────
create table if not exists contactos (
  id        uuid primary key default uuid_generate_v4(),
  nombre    text not null,
  email     text not null,
  telefono  text,
  mensaje   text not null,
  created_at timestamptz default now(),
  leido     boolean default false
);

-- ─────────────────────────────────────────
-- Migraciones adicionales (ejecutar si ya tienes la tabla clientes)
-- ─────────────────────────────────────────
alter table clientes add column if not exists fee_energia          numeric default 0;
alter table clientes add column if not exists fee_potencia         numeric default 0;
alter table clientes add column if not exists kwh_anuales          numeric default 0;
alter table clientes add column if not exists kw_contratados       numeric default 0;
alter table clientes add column if not exists proximo_contacto     date;
alter table clientes add column if not exists fecha_inicio_contrato date;

-- ─────────────────────────────────────────
-- RLS policies (adjust to your auth setup)
-- ─────────────────────────────────────────
alter table leads     enable row level security;
alter table clientes  enable row level security;
alter table facturas  enable row level security;
alter table contactos enable row level security;

-- Authenticated users can read/write all rows (single-tenant app)
create policy "auth_all_leads"    on leads    for all using (auth.role() = 'authenticated');
create policy "auth_all_clientes" on clientes for all using (auth.role() = 'authenticated');
create policy "auth_all_facturas" on facturas for all using (auth.role() = 'authenticated');

-- Service role (backend) can insert leads from public comparador
create policy "service_insert_leads" on leads
  for insert with check (true);

create policy "auth_all_contactos"    on contactos for all using (auth.role() = 'authenticated');
create policy "public_insert_contactos" on contactos for insert with check (true);

-- ─────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────
create index if not exists leads_estado_idx    on leads    (estado);
create index if not exists leads_created_idx   on leads    (created_at desc);
create index if not exists clientes_estado_idx on clientes (estado);
create index if not exists facturas_cliente_idx on facturas (cliente_id);
