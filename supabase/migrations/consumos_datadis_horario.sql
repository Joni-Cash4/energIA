-- Migración: curva horaria de consumo, por CUPS (Datadis get-consumption-data).
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor → New query).
--
-- POR QUÉ
-- `consumos_datadis` guarda solo el kwh_total del mes. La curva hora a hora que
-- Datadis devuelve en la misma llamada se descartaba.
--
-- PARA QUÉ
-- `/api/market-historical` promedia el PMD de OMIE por periodo con media aritmética
-- (`vals.reduce(sum)/vals.length`). Es la aproximación que ya documenta
-- architecture/product-principles.md: sin curva no se puede ponderar por el consumo
-- real de cada hora. Medido con la curva real de ES0021000009822029MZ contra OMIE
-- ene-ago 2026: la media aritmética se desvía -5,58 €/MWh en el acumulado, y por
-- periodo entre -0,99 (P6) y -10,96 (P4). Con esta tabla se pondera y se deja de
-- estimar.
--
-- CLAVE POR CUPS, NO POR CLIENTE
-- La curva es un atributo del punto de suministro, no del titular: un cliente puede
-- tener varios CUPS, y un mismo CUPS puede estar ligado a clientes de cuentas
-- distintas (37 casos confirmados en cups_entidad_fase1.sql). Se referencia `cups(id)`
-- de ADR-0001 en vez de repetir el texto del CUPS o colgar de cliente_id.

create table if not exists consumos_datadis_horario (
  cups_id     uuid not null references cups(id) on delete cascade,
  fecha       date not null,
  hora        smallint not null,          -- 0-23, hora local España
  kwh         numeric not null,
  updated_at  timestamptz default now(),
  primary key (cups_id, fecha, hora)
);

-- El acceso normal es "dame la curva de este CUPS entre dos fechas": lo cubre la PK.

-- Mismo criterio que la tabla `cups` a la que cuelga: acceso por usuario autenticado,
-- no por dueño. Forzar un único dueño rompería el caso real de un CUPS compartido
-- entre cuentas — la decisión de acotarlo sigue pendiente para `cups` (ver la nota
-- en privacidad_total_por_cuenta.sql) y esta tabla debe seguirla cuando se tome.
alter table consumos_datadis_horario enable row level security;

drop policy if exists consumos_datadis_horario_auth_all on consumos_datadis_horario;
create policy consumos_datadis_horario_auth_all on consumos_datadis_horario
  for all using (auth.role() = 'authenticated');

grant select on consumos_datadis_horario to authenticated;
grant select, insert, update, delete on consumos_datadis_horario to service_role;
