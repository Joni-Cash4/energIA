-- Bug real: empresas_pago no tenía grant a service_role (mismo patrón
-- recurrente ya visto con comisiones_generadas/comision_cobros, ADR-0003).
-- Sin esto, cualquier cron que resuelva el nombre de la empresa pagadora
-- con la service role key falla en silencio y cae al fallback "Empresa
-- desconocida" (ver api/cron/prefactura-alert/route.ts).
grant select, insert, update, delete on empresas_pago to service_role;
