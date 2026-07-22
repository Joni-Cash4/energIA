-- Tabla para el PMD horario real de OMIE, sincronizado a diario desde el sistema
-- Python local de Jonathan (misma IP residencial que ya usa para ESIOS/OMIE en
-- fuentes_mercado.py). Vercel dejaba de recibir datos reales de OMIE en algunas
-- peticiones porque OMIE bloquea/rate-limita las IPs de datacenter (Vercel);
-- por eso el aviso de "estimación" en nueva-factura. Con esta tabla, Vercel deja
-- de llamar a OMIE en directo y solo lee aquí — igual que ya hace con
-- mercado_sc_cap / mercado_perd (ver mercado_real_mensual.sql).
--
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor → New query).

create table if not exists mercado_pmd_diario (
  fecha date not null,               -- 'YYYY-MM-DD'
  hora smallint not null,            -- 0-23, hora local España
  precio_mwh numeric not null,       -- €/MWh, precio marginal OMIE (MARGINALPDBC)
  updated_at timestamptz default now(),
  primary key (fecha, hora)
);

alter table mercado_pmd_diario enable row level security;

create policy "lectura publica pmd_diario" on mercado_pmd_diario
  for select using (true);

-- Solo la service role key (script local de Jonathan) puede escribir.
grant select, insert, update on public.mercado_pmd_diario to service_role;
