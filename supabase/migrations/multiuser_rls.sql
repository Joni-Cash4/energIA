-- Migración: seguridad multi-usuario
-- Cada usuario solo ve sus propios clientes y facturas.
-- Leads del comparador público son visibles a todos los usuarios autenticados (pool compartido).
--
-- INSTRUCCIONES:
-- 1. Ejecutar este script en Supabase SQL Editor
-- 2. Después de ejecutar, correr el UPDATE de backfill (ver al final) con tu user_id
--    (lo encuentras en Supabase > Authentication > Users)

-- ── 1. Añadir user_id a las tablas ─────────────────────────────────────────
alter table clientes  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table leads     add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table facturas  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- ── 2. Índices de rendimiento ────────────────────────────────────────────────
create index if not exists clientes_user_idx on clientes (user_id);
create index if not exists leads_user_idx    on leads    (user_id);
create index if not exists facturas_user_idx on facturas (user_id);

-- ── 3. Eliminar políticas antiguas (demasiado permisivas) ────────────────────
drop policy if exists "auth_all_clientes"    on clientes;
drop policy if exists "auth_all_leads"       on leads;
drop policy if exists "auth_all_facturas"    on facturas;
drop policy if exists "auth_all_contactos"   on contactos;
drop policy if exists "service_insert_leads" on leads;

-- ── 4. Políticas nuevas ──────────────────────────────────────────────────────

-- CLIENTES: solo el propietario
create policy "clientes_owner" on clientes
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- FACTURAS: solo el propietario
create policy "facturas_owner" on facturas
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- LEADS: visibles a todos los usuarios autenticados si no tienen dueño asignado,
--        o al dueño si ya están asignados.
create policy "leads_read" on leads
  for select using (
    auth.role() = 'authenticated'
    and (user_id is null or user_id = auth.uid())
  );

create policy "leads_update" on leads
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- El comparador público puede insertar leads sin sesión de usuario
create policy "leads_public_insert" on leads
  for insert with check (true);

-- CONTACTOS: cualquier usuario autenticado los ve (son mensajes del formulario web)
create policy "contactos_auth_read" on contactos
  for select using (auth.role() = 'authenticated');

create policy "contactos_auth_update" on contactos
  for update using (auth.role() = 'authenticated');

-- El formulario público puede insertar contactos sin sesión
create policy "contactos_public_insert" on contactos
  for insert with check (true);

-- ── 5. BACKFILL de datos existentes ─────────────────────────────────────────
-- Sustituye '<TU_USER_ID>' por tu UUID de Supabase > Authentication > Users
-- y ejecuta esto por separado después de la migración principal:
--
-- update clientes set user_id = '<TU_USER_ID>' where user_id is null;
-- update facturas set user_id = '<TU_USER_ID>' where user_id is null;
-- (los leads sin user_id quedan en el pool compartido, no hace falta actualizarlos)
