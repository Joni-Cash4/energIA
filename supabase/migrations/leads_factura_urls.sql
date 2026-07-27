-- Migración: guardar la factura original subida al comparador público en
-- cada lead, para poder verificar el análisis manualmente (sin CUPS/factura
-- real delante no se puede auditar bien un caso). Ejecutar en Supabase SQL
-- Editor.
--
-- Solo se guarda si el visitante completa el formulario y pide el informe
-- (paso 3), no en el simple análisis del paso 1 -- ver Step1Upload.tsx y
-- privacidad.tsx, actualizados para reflejarlo.

alter table leads add column if not exists factura_urls text[];

comment on column leads.factura_urls is
  'URLs de las fotos/PDFs originales de la factura subida al comparador público (api/send-report) -- evidencia para verificar el análisis, no se edita a mano.';
