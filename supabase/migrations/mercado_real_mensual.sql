-- Tablas para los valores reales de mercado (SC, CAP, PERD) sincronizados
-- mensualmente desde el sistema Python local de Jonathan (vía ESIOS).
-- Vercel NUNCA llama a ESIOS — solo lee estas tablas. Ejecutar en el SQL Editor
-- de Supabase (Dashboard → SQL Editor → New query → pegar y ejecutar).

create table if not exists mercado_sc_cap (
  mes text primary key,              -- 'YYYY-MM'
  sc numeric not null,               -- €/kWh, servicios de ajuste
  cap numeric not null,              -- €/kWh, pagos por capacidad
  updated_at timestamptz default now()
);

create table if not exists mercado_perd (
  mes text not null,                 -- 'YYYY-MM'
  tarifa text not null,              -- '2.0TD' | '3.0TD' | '6.1TD'
  periodo text not null,             -- 'P1'..'P6'
  perd numeric not null,             -- coeficiente de pérdidas
  updated_at timestamptz default now(),
  primary key (mes, tarifa, periodo)
);

-- RLS: solo lectura pública (anon), escritura solo con service role (el script local).
alter table mercado_sc_cap enable row level security;
alter table mercado_perd enable row level security;

create policy "lectura publica sc_cap" on mercado_sc_cap
  for select using (true);

create policy "lectura publica perd" on mercado_perd
  for select using (true);

-- No se crea policy de INSERT/UPDATE para anon — solo la service role key
-- (que se usa desde el script local de Jonathan) puede escribir, por diseño
-- de Supabase (service role bypassa RLS).

-- IMPORTANTE: las tablas creadas desde el SQL Editor no llevan permisos
-- automáticos para service_role — hay que concedérselos explícitamente.
grant select, insert, update on public.mercado_sc_cap to service_role;
grant select, insert, update on public.mercado_perd to service_role;
