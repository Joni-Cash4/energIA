-- Migración: privacidad estricta por cuenta -- ninguna cuenta ve datos de otra,
-- salvo lo que se le reasigne explícitamente. Decisión 2026-08-22: tras cerrar
-- el registro público abierto en /login, Jonathan pidió que "absolutamente
-- todo" sea privado por cuenta, no solo clientes/facturas (que ya lo eran).
--
-- Antes de esto: leads y contactos eran visibles para CUALQUIER cuenta
-- autenticada (sin dueño), y consumos_datadis (consumo real Datadis por
-- cliente) no comprobaba dueño en absoluto -- hallazgo nuevo de esta
-- migración, no detectado en el primer audit.
--
-- Los leads/contactos nuevos los genera un visitante anónimo, no una cuenta
-- logueada -- no hay "dueño natural" al crearse. Decisión de Jonathan: todo
-- lo nuevo se asigna por defecto a su cuenta; si quiere que otra cuenta
-- (ej. su mujer) trabaje uno, lo reasigna él a mano desde el dashboard.
--
-- cups NO se toca aquí: un mismo CUPS puede estar legítimamente ligado a
-- clientes de distintas cuentas (37 casos confirmados en cups_entidad_fase1.sql),
-- forzarle un único dueño rompería ese caso real. Pendiente de decisión aparte.
--
-- Ejecutar en Supabase SQL Editor, de arriba a abajo.

-- ── 1. CONTACTOS: añadir user_id (no lo tenía) ───────────────────────────────
alter table contactos add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists contactos_user_idx on contactos (user_id);

-- Backfill: todo lo ya existente pasa a la cuenta de Jonathan.
update contactos set user_id = '2dd86dac-d444-4e2c-83be-ccc21cf7af80' where user_id is null;

drop policy if exists "contactos_auth_read"   on contactos;
drop policy if exists "contactos_auth_update" on contactos;

create policy "contactos_owner_read" on contactos
  for select using (auth.uid() = user_id);

create policy "contactos_owner_update" on contactos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- El formulario público sigue pudiendo insertar sin sesión (contactos_public_insert
-- ya existe y no se toca) -- el user_id lo fija el propio código del servidor
-- al insertar, no depende de esta política.

-- ── 2. LEADS: quitar el "pool compartido", dueño estricto ───────────────────
-- Backfill primero: todo lead sin dueño pasa a la cuenta de Jonathan.
update leads set user_id = '2dd86dac-d444-4e2c-83be-ccc21cf7af80' where user_id is null;

drop policy if exists "leads_read"   on leads;
drop policy if exists "leads_update" on leads;

create policy "leads_owner_read" on leads
  for select using (auth.uid() = user_id);

create policy "leads_owner_update" on leads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- leads_public_insert (sin sesión, con check(true)) ya existe y no se toca --
-- el user_id lo fija el código del servidor al insertar.

-- ── 3. CONSUMOS_DATADIS: no comprobaba dueño en absoluto -- hallazgo nuevo ──
-- No tiene user_id propio; el dueño real es el del cliente al que pertenece
-- el CUPS (clientes.user_id), así que se resuelve por join, sin añadir columna.
alter table consumos_datadis enable row level security;

drop policy if exists "auth_all_consumos_datadis" on consumos_datadis;

create policy "consumos_datadis_owner" on consumos_datadis
  for all using (
    exists (
      select 1 from clientes c
      where c.id = consumos_datadis.cliente_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from clientes c
      where c.id = consumos_datadis.cliente_id and c.user_id = auth.uid()
    )
  );
