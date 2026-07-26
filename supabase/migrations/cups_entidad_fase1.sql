-- Migración: CUPS como entidad de referencia (ADR-0001) — FASE 1.
-- Ejecutar en Supabase SQL Editor.
--
-- 100% aditiva: crea la tabla `cups`, la puebla con los códigos ya usados en
-- clientes/contratos/facturas/consumos_datadis, y añade un `cups_id` opcional
-- a esas tablas sin tocar ni borrar el campo de texto `cups` existente. No
-- cambia el comportamiento de la web todavía — eso es la Fase 2 (aparte).
--
-- Auditoría real 2026-07-26 (346 clientes, 174 contratos): 37 CUPS en
-- `clientes` están compartidos por 2+ titulares distintos (todos "firmado")
-- — confirma que el problema que motivó el ADR-0001 es real, no un caso
-- raro. No se detectaron problemas de mayúsculas/espacios.
--
-- OJO: un código (`ES002100003285478HV`) tiene 19 caracteres en vez de los
-- 20 habituales — probable error de tecleo. Se importa tal cual (no se
-- adivina el valor correcto); revisar y corregir a mano en la tabla `cups`
-- cuando se sepa el código real, el cups_id que lo referencia se realinea
-- solo al hacerlo.

create table if not exists cups (
  id            uuid primary key default uuid_generate_v4(),
  codigo        text not null unique,
  direccion     text,
  cp            text,
  poblacion     text,
  provincia     text,
  tarifa_acceso text,
  notas         text,
  created_at    timestamptz default now()
);

alter table cups enable row level security;

drop policy if exists "cups_auth_all" on cups;
create policy "cups_auth_all" on cups for all using (auth.role() = 'authenticated');

grant select, insert, update, delete on cups to authenticated;
grant select, insert, update, delete on cups to service_role;

-- Poblar con todos los códigos distintos ya usados. on conflict do nothing
-- evita duplicados si el mismo código aparece en varias tablas.
insert into cups (codigo)
select distinct cups from clientes where cups is not null
union
select distinct cups from contratos where cups is not null
union
select distinct cups from facturas where cups is not null
union
select distinct cups from consumos_datadis where cups is not null
on conflict (codigo) do nothing;

-- Añadir cups_id (opcional) — no se toca el texto existente.
alter table clientes         add column if not exists cups_id uuid references cups(id) on delete set null;
alter table contratos        add column if not exists cups_id uuid references cups(id) on delete set null;
alter table facturas         add column if not exists cups_id uuid references cups(id) on delete set null;
alter table consumos_datadis add column if not exists cups_id uuid references cups(id) on delete set null;

create index if not exists clientes_cups_idx         on clientes         (cups_id);
create index if not exists contratos_cups_idx        on contratos        (cups_id);
create index if not exists facturas_cups_idx         on facturas         (cups_id);
create index if not exists consumos_datadis_cups_idx on consumos_datadis (cups_id);

-- Rellenar cups_id cruzando por el texto ya existente.
update clientes         c set cups_id = k.id from cups k where c.cups = k.codigo and c.cups_id is null;
update contratos        c set cups_id = k.id from cups k where c.cups = k.codigo and c.cups_id is null;
update facturas         f set cups_id = k.id from cups k where f.cups = k.codigo and f.cups_id is null;
update consumos_datadis d set cups_id = k.id from cups k where d.cups = k.codigo and d.cups_id is null;
