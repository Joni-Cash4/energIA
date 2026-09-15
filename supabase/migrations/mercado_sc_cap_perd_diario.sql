-- SC, CAP y PERD por DÍA, de ESIOS PVPCDATA (archivo 70). Lo carga a diario el cron
-- /api/cron/mercado-sc-cap-perd-diario con una sola petición (del día más antiguo que
-- falte hasta ayer). Sirve para calcular cada factura con sus días exactos en vez de
-- con el mes de fecha_inicio: una factura que abarca dos meses y el mes en curso
-- dejan de caer en valores de reserva.
--
-- Mismo cálculo que el cron mensual mercado-perd-sync, pero por día:
--   sc   = media del día de (SAHPCB + FOMPCB + FOSPCB + INTPCB + EDSRPCB) / 1000  €/kWh
--   cap  = media del día de PCAPPCB / 1000                                     €/kWh
--   perd = (1 + media del día de COF2TD) × 1,04 — igual para todas las tarifas y periodos
--
-- Las tablas mensuales mercado_sc_cap y mercado_perd se quedan como están.
--
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor → New query).

create table if not exists mercado_sc_cap_perd_diario (
  fecha date primary key,            -- 'YYYY-MM-DD'
  sc numeric not null,               -- €/kWh
  cap numeric not null,              -- €/kWh
  perd numeric not null,             -- tanto por uno
  updated_at timestamptz default now()
);

alter table mercado_sc_cap_perd_diario enable row level security;

create policy "lectura publica sc_cap_perd_diario" on mercado_sc_cap_perd_diario
  for select using (true);

-- Solo la service role key (cron y scripts) puede escribir.
grant select, insert, update on public.mercado_sc_cap_perd_diario to service_role;
