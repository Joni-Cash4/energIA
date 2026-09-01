-- Consulta: diferencia media de energía frente a Próxima, por comercializadora
-- y segmento. Data-asset descrito en memoria project-iaenergia-diferencia-vs-proxima.
-- Pegar en el SQL Editor de Supabase cuando haya varias facturas guardadas.
--
-- Solo cuenta filas con diferencia_energia_mwh no nulo (se guarda null si la
-- simulación no tuvo OMIE real del periodo — ver facturas_diferencia_segmento.sql).
-- No compara contra Próxima misma (no tiene sentido: siempre da ~0).

select
  comercializadora,
  segmento,
  count(*)                                as n_facturas,
  round(avg(diferencia_energia_mwh), 1)   as diferencia_media_mwh,
  round(min(diferencia_energia_mwh), 1)   as diferencia_min_mwh,
  round(max(diferencia_energia_mwh), 1)   as diferencia_max_mwh,
  round(stddev(diferencia_energia_mwh), 1) as desviacion_mwh,
  min(fecha_fin)                          as desde,
  max(fecha_fin)                          as hasta
from facturas
where diferencia_energia_mwh is not null
  and comercializadora is not null
  and comercializadora not ilike '%proxima%'
  and comercializadora not ilike '%próxima%'
  and comercializadora not ilike '%cristalina%'
group by comercializadora, segmento
order by n_facturas desc, diferencia_media_mwh desc;
