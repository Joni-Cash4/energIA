-- Migración: política RLS para poder leer los archivos de leads-facturas
-- ahora que el bucket pasa de público a privado (arreglo de privacidad,
-- 2026-08-22 -- las facturas de leads llevaban CUPS y consumo accesibles
-- sin autenticación con cualquiera que tuviera la URL directa).
--
-- El bucket se cambia a privado vía Storage API (fuera de esta migración).
-- Sin esta política, "authenticated" no podría generar signed URLs para
-- ver las facturas ya subidas desde /dashboard/leads.
--
-- Mismo nivel de confianza que ya usa la tabla leads (ver
-- leads_grants_authenticated.sql): cualquier usuario "authenticated" puede
-- leerlas, igual que ya puede leer nombre/email/CUPS de la fila del lead.
--
-- Ejecutar en Supabase SQL Editor.

create policy "leads_facturas_authenticated_read"
on storage.objects for select
to authenticated
using (bucket_id = 'leads-facturas');
