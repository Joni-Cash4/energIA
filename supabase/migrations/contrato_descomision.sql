-- Migración: descomisión por baja anticipada de contrato.
-- Ejecutar en Supabase SQL Editor.
--
-- Cuando un contrato se saca antes de su vencimiento (normalmente para llevarlo
-- a otra comercializadora), la anterior reclama la parte de comisión no
-- devengada. Caso real que motiva esto — NOREÑA HOYUELOS TRUEBA CB,
-- CUPS ES0021000009985760VP: contrato TOTAL 21/04/2026→20/04/2027 con 1.638,75 €
-- ya cobrados, sacado a Próxima el 05/09/2026. Con prorrata por días quedan 227
-- de 364 sin devengar → 1.021,97 € a devolver. No es un caso aislado: el mismo
-- CUPS ya tuvo una baja anticipada con ACCIONA el 19/04/2024.
--
-- Hasta ahora no había dónde anotarlo: `estado='baja'` y `motivo_baja` dicen
-- QUE se fue y POR QUÉ, pero no CUÁNDO exactamente ni CUÁNTO cuesta.

-- ── 1. Fecha real de baja del suministro ─────────────────────────────────────
-- No es la fecha de firma del contrato nuevo: entre una y otra pasan semanas
-- (el cambio de suministrador tarda), y cada día cuenta. En el caso de arriba
-- son 4,50 €/día — entre el 05/09 y el 31/10 hay 252 € de diferencia.
-- Se deja nula mientras la baja no sea efectiva.
alter table contratos add column if not exists fecha_baja date;

-- ── 2. Descomisión realmente cargada por la comercializadora ─────────────────
-- calcularDescomision() (lib/comisiones.ts) estima la prorrata por días, pero
-- manda lo que la comercializadora acabe cobrando: aquí se anota el importe del
-- cargo cuando llega, para poder cuadrarlo contra la estimación y detectar si
-- han aplicado una fecha de baja que no toca. Null = aún no ha llegado el cargo.
alter table contratos add column if not exists descomision numeric;

-- Solo tiene sentido en contratos dados de baja.
create index if not exists contratos_fecha_baja_idx on contratos (fecha_baja)
  where fecha_baja is not null;
