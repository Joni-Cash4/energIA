-- Tarifas fijas vigentes sincronizadas desde el maestro local de Jonathan
-- (C:\MonitorizacionEnergetica\tarifas\tarifas_maestro.xlsx, alimentado por el
-- watchdog de anexos). La web compara cada factura contra TODOS los productos
-- activos de esta tabla y recomienda el más barato. Vercel nunca lee el Excel —
-- solo esta tabla. Ejecutar en el SQL Editor de Supabase (Dashboard → SQL
-- Editor → New query → pegar y ejecutar).

create table if not exists tarifas_fijas (
  comercializadora text not null,      -- 'ATULADO', 'PROXIMA', 'NATURGY'...
  producto text not null,              -- nombre del producto tal cual en el maestro
  tarifa_acceso text not null,         -- '2.0TD' | '3.0TD' | '6.1TD' | '6.2TD'
  energia jsonb not null,              -- {"P1": 0.150959, ...} €/kWh
  potencia jsonb not null,             -- {"P1": 37.8567, ...} €/kW·AÑO (dividir /365 para €/kW·día)
  fecha_anexo date,                    -- fecha del anexo de origen (para caducidad)
  notas text,
  activo boolean not null default true,
  updated_at timestamptz default now(),
  primary key (comercializadora, producto, tarifa_acceso)
);

-- RLS: solo lectura pública (anon), escritura solo con service role (el script local).
alter table tarifas_fijas enable row level security;

create policy "lectura publica tarifas_fijas" on tarifas_fijas
  for select using (true);

-- No se crea policy de INSERT/UPDATE para anon — solo la service role key
-- (que se usa desde el script local de Jonathan) puede escribir.

-- IMPORTANTE: las tablas creadas desde el SQL Editor no llevan permisos
-- automáticos para service_role — hay que concedérselos explícitamente.
grant select, insert, update, delete on public.tarifas_fijas to service_role;
