-- Maximetros mensuales (potencia maxima demandada por periodo tarifario) via Datadis get-max-power.
-- Un ciclo de lectura no siempre coincide con el mes natural (puede desplazarse 1-2 dias en
-- el limite), por eso year_month se asigna al mes dominante del ciclo, no a la fecha exacta
-- de cada pico individual.
create table if not exists potencia_datadis (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  cups text not null,
  year_month text not null,       -- YYYY-MM del ciclo de lectura
  periodo text not null,          -- '1'..'6' (P1..P6 Datadis)
  potencia_max_kw numeric not null,
  fecha_pico date,
  hora_pico text,
  fecha_consulta timestamptz default now(),
  unique (cliente_id, cups, year_month, periodo)
);

create index if not exists idx_potencia_datadis_cliente on potencia_datadis(cliente_id);
