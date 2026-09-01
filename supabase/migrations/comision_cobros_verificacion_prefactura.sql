-- Verificación de prefactura (comision_cobros): permite marcar que una cuota
-- ha sido cotejada contra la prefactura real que envía la empresa pagadora
-- (ej. Geoatlanter para Próxima/Atulado), sin tocar cobrado/fecha_cobro —
-- ese sigue siendo un evento distinto y posterior (dinero en el banco).
alter table comision_cobros
  add column if not exists verificado_prefactura boolean not null default false,
  add column if not exists prefactura_importe numeric(10,2),
  add column if not exists prefactura_evidencia_url text,   -- storage PATH (bucket privado), no URL pública
  add column if not exists verificado_en timestamptz;

create index if not exists comision_cobros_verificado_idx on comision_cobros (verificado_prefactura);

-- Bucket 'prefacturas': crear a mano en Supabase Storage con public = false
-- (documento financiero de un tercero — mismo criterio que llevó a
-- leads-facturas a privado, ver leads_facturas_storage_privado.sql).
-- Sin esta policy, "authenticated" no podría generar signed URLs para ver
-- las prefacturas ya subidas desde /dashboard/cobros.
create policy "prefacturas_authenticated_read"
on storage.objects for select
to authenticated
using (bucket_id = 'prefacturas');
