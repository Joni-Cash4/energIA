-- Migración: facturación mensual de comisiones por empresa pagadora
-- Ejecutar en Supabase SQL Editor

-- ── 1. Empresas pagadoras ────────────────────────────────────────────────────
create table if not exists empresas_pago (
  id                          uuid primary key default uuid_generate_v4(),
  user_id                     uuid references auth.users(id) on delete cascade not null,
  nombre                      text not null,
  nif                         text not null,
  direccion                   text,
  cp                          text,
  poblacion                   text,
  provincia                   text,
  retencion_pct               numeric(5,2) default 7,
  comercializadoras_keywords  text[] default '{}',  -- minúsculas, para auto-resolver
  es_default                  boolean default false, -- fallback si ninguna keyword matchea
  activo                      boolean default true,
  created_at                  timestamptz default now()
);

alter table empresas_pago enable row level security;

create policy "empresas_pago_owner" on empresas_pago
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists empresas_pago_user_idx on empresas_pago (user_id);

grant select, insert, update, delete on empresas_pago to authenticated;

-- ── 2. Comisiones generadas (ledger de altas/renovaciones/correcciones) ──────
create table if not exists comisiones_generadas (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  contrato_id      uuid references contratos(id) on delete set null,
  cliente_id       uuid references clientes(id) on delete set null,
  cups             text,
  comercializadora text,
  empresa_pago_id  uuid references empresas_pago(id) not null,
  tipo             text default 'renovacion'
    check (tipo in ('alta','renovacion','correccion')),
  importe          numeric(10,2) not null,  -- puede ser negativo (correcciones)
  fecha            date not null,           -- agrupa por mes para el borrador
  facturado        boolean default false,
  numero_factura   text,
  notas            text,
  created_at       timestamptz default now()
);

alter table comisiones_generadas enable row level security;

create policy "comisiones_generadas_owner" on comisiones_generadas
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists comisiones_generadas_user_idx     on comisiones_generadas (user_id);
create index if not exists comisiones_generadas_fecha_idx    on comisiones_generadas (fecha);
create index if not exists comisiones_generadas_empresa_idx  on comisiones_generadas (empresa_pago_id);
create index if not exists comisiones_generadas_facturado_idx on comisiones_generadas (facturado);

grant select, insert, update, delete on comisiones_generadas to authenticated;

-- ── 3. Seed de las 4 empresas pagadoras ───────────────────────────────────────
-- Sustituye '<TU_USER_ID>' por tu UUID de Supabase > Authentication > Users
-- y ejecuta esto por separado después de la migración principal:
--
-- insert into empresas_pago (user_id, nombre, nif, direccion, cp, poblacion, provincia, comercializadoras_keywords, es_default) values
--   ('<TU_USER_ID>', 'Gaolania Servicios SL',           'B98717457', 'C/ Colon 60, 5', '46004', 'Valencia', 'Valencia', '{ganaenergia}', false),
--   ('<TU_USER_ID>', 'Escandinava de Electricidad SL',  'B85551273', null, null, null, null,                 '{nordy}',       false),
--   ('<TU_USER_ID>', 'Geoatlanter, S.L.',                'B85021426', null, null, null, null,                 '{proxima,atulado}', false),
--   ('<TU_USER_ID>', 'Soillik Marketing SLU',            'B95573580', null, null, null, null,                 '{}',            true);
