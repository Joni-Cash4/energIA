-- Migración: GRANT faltante para el rol anon en leads/contactos.
-- Ejecutar en Supabase SQL Editor.
--
-- Bug real confirmado en producción (2026-07-27): el comparador público
-- (Step3Form -> api/send-report) manda el email del informe correctamente,
-- pero el lead nunca queda guardado (probado con un caso real: email
-- recibido, /dashboard/leads vacío). multiuser_rls.sql ya definía las
-- políticas RLS para permitir inserción anónima (leads_public_insert,
-- contactos_public_insert, with check(true)), pero el GRANT de tabla al rol
-- anon nunca se emitió -- Postgres rechaza antes de evaluar las políticas
-- RLS (mismo patrón recurrente ya visto varias veces con service_role:
-- facturas, gestiones, factura_validaciones, comisiones_generadas -- esta
-- vez le tocó al rol anon).
--
-- Reproducido directamente contra producción con la clave anon real:
--   {"code":"42501","message":"permission denied for table leads"}
--   {"code":"42501","message":"permission denied for table contactos"}
--
-- Nota: independientemente de este GRANT, el código de send-report/contacto
-- se corrigió para usar siempre la clave de servidor (service_role/secret),
-- nunca la anon key -- este GRANT deja la política RLS ya escrita
-- funcionando de verdad, por si en el futuro algo vuelve a depender de ella.

grant select, insert on public.leads to anon;
grant select, insert on public.contactos to anon;
