-- Migración: foto/captura de la comisión pactada por contrato (ADR-0003,
-- pieza pendiente del flujo "foto + IA"). Ejecutar en Supabase SQL Editor.
--
-- Guarda la URL de evidencia igual que facturas_contrato.pdf_url. No se
-- modela vigencia todavía (decisión explícita de Jonathan, 2026-07-27): el
-- fee vigente de un contrato es el que hay ahora mismo en fee_energia_mwh/
-- fee_potencia_mwh, se sobreescribe en la siguiente renovación en vez de
-- llevar histórico. Si eso deja de ser suficiente, se revisita.

alter table contratos add column if not exists comision_foto_url text;

comment on column contratos.comision_foto_url is
  'URL de la foto/captura de la comisión pactada que mandó la comercializadora, extraída por IA (api/comision-foto/upload) — evidencia, no se edita a mano.';
