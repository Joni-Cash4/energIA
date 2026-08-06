-- Calendario de cobros de comisiones.
-- Próxima fracciona el pago de cada comisión según su importe: > 1.000 € en 3
-- pagos, > 10.000 € en 6, resto pago único (medida inicial, a negociar). Cada
-- pago vence el último día de su mes. Esta tabla guarda una fila por cuota y su
-- estado (previsto/cobrado) para conciliar con lo que ingresa Próxima.
create table if not exists comision_cobros (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users(id),
  comision_id    uuid not null references comisiones_generadas(id) on delete cascade,
  num_pago       integer not null,          -- 1..total_pagos
  total_pagos    integer not null,
  importe        numeric(10,2) not null,
  fecha_prevista date not null,             -- vencimiento (último día del mes)
  cobrado        boolean default false,
  fecha_cobro    date,
  prefactura_num text,                       -- nº de prefactura de Próxima
  notas          text,
  created_at     timestamptz default now(),
  unique (comision_id, num_pago)
);

alter table comision_cobros enable row level security;

drop policy if exists "comision_cobros_owner" on comision_cobros;
create policy "comision_cobros_owner" on comision_cobros
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists comision_cobros_user_idx     on comision_cobros (user_id);
create index if not exists comision_cobros_comision_idx on comision_cobros (comision_id);
create index if not exists comision_cobros_fecha_idx    on comision_cobros (fecha_prevista);
create index if not exists comision_cobros_cobrado_idx  on comision_cobros (cobrado);

grant select, insert, update, delete on comision_cobros to authenticated;
