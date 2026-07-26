-- Migración: consolidar la comisión por contrato en una sola columna (ADR-0003).
-- Ejecutar en Supabase SQL Editor.
--
-- Diagnóstico real (2026-07-26, 174 contratos):
--   - co_energia_mwh: 0 contratos lo tienen relleno. Nunca se ha usado.
--   - fee_energia_mwh: 173 de 174 siguen en el valor por defecto (5), nunca
--     tocado a mano. Solo 1 contrato real (Próxima, Cristalina Web) tiene un
--     valor negociado de verdad (18).
-- El validador de facturas caía siempre al valor por defecto del producto de
-- todas formas (co_energia_mwh vacío) — este cambio no le quita precisión,
-- solo unifica de dónde puede venir un override real por contrato.

-- ── 1. fee_energia_mwh deja de tener un valor por defecto inventado ─────────
alter table contratos alter column fee_energia_mwh drop default;

-- ── 2. Limpiar el placeholder: si sigue en el valor por defecto antiguo (5),
--       no es un dato real, se pone a null para no confundir al validador ni
--       al seguimiento de comisiones con un número inventado.
update contratos set fee_energia_mwh = null where fee_energia_mwh = 5;

-- ── 3. Retirar co_energia_mwh — columna sin uso real, el código ya no la lee.
alter table contratos drop column if exists co_energia_mwh;
