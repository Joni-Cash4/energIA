-- Migración: diferencia de energía frente a Próxima + segmento en facturas.
-- Ejecutar en Supabase SQL Editor ANTES de desplegar el código que las inserta
-- (si no, el insert de nueva-factura fallará por columnas inexistentes).
--
-- Base del data-asset por comercializadora (ver memoria
-- project-iaenergia-diferencia-vs-proxima): cada análisis guarda cuánto más
-- paga el cliente en ENERGÍA frente a Próxima (€/MWh) y el segmento, para poder
-- sacar media / distribución / evolución por comercializadora y tipo de cliente.
--
-- diferencia_energia_mwh:
--   (coste_actual_energia - coste_nuevo_energia) / kwh_total * 1000.
--   Positivo = el cliente paga de más en energía vs Próxima = potencial de ahorro.
--   Se guarda SOLO cuando la simulación se basó en OMIE real del periodo
--   (mercado_historico_ok); si no, queda NULL para no ensuciar los agregados.
--   No es "sobrecoste" ni un juicio sobre el competidor: es una tarifa distinta.
-- segmento: derivado de la tarifa.
--   OJO: 2.0TD ('residencial') mezcla hogar y micro-empresa — no distinguibles
--   desde la factura; afinable más adelante (p.ej. por titular NIF/CIF o consumo).

alter table facturas add column if not exists diferencia_energia_mwh numeric;
alter table facturas add column if not exists segmento text;

create index if not exists facturas_comercializadora_idx on facturas (comercializadora);
create index if not exists facturas_segmento_idx on facturas (segmento);
