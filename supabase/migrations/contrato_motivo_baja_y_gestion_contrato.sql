-- Migración: motivo_baja en contratos (ADR-0002) + contrato_id en gestiones
-- (ADR-0004). Ejecutar en Supabase SQL Editor.

-- ── 1. Motivo de baja de un contrato ─────────────────────────────────────────
-- Agrupa los 4 motivos reales confirmados por Jonathan: cambio de gestor,
-- cambio de comercializadora, cierre del negocio, o CUPS dado de baja.
alter table contratos add column if not exists motivo_baja text
  check (motivo_baja in ('cambio_gestor','cambio_comercializadora','cierre_negocio','cups_baja'));

-- ── 2. Gestión ligada a un contrato concreto ─────────────────────────────────
-- Opcional: sigue permitiendo gestiones sin contrato (ej. sobre un futuro
-- cliente sin ficha todavía) — solo se rellena cuando cliente y contrato son
-- conocidos, para no depender del texto libre de cups/compañía cuando un
-- cliente tiene varios contratos.
alter table gestiones add column if not exists contrato_id uuid
  references contratos(id) on delete set null;

create index if not exists gestiones_contrato_idx on gestiones (contrato_id);
