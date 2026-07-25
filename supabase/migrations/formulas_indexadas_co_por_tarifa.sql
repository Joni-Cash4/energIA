-- Migración: corregir el CO de JAZZ TE5 — varía por tarifa de acceso.
-- Ejecutar en Supabase SQL Editor DESPUÉS de formulas_indexadas_co.sql.
--
-- El CO (margen comercial de IAenergia, en c€/kWh) sale de la tabla de comisiones
-- "COMISIONES INDEXADO ROCK-JAZZ" y NO es único por producto: depende de la
-- tarifa de acceso. Para JAZZ/ROCK TE5:
--     2.0TD → 3,0 c€/kWh = 30 €/MWh
--     3.0TD → 2,3 c€/kWh = 23 €/MWh
--     6.1TD → 2,0 c€/kWh = 20 €/MWh
--     6.2TD → no aparece en la tabla; se aproxima a 20 (como 6.1TD).
-- (el margen propio de TotalEnergies es aparte y desconocido — asumido dentro
--  del CMFi "coste de gestión"; fuente de un pequeño margen de error inevitable)
--
-- La migración anterior había puesto 23 a todas las tarifas: correcto solo para
-- 3.0TD. Esto lo ajusta por tarifa.

update formulas_indexadas set co_eur_mwh = 30
 where match_comercializadora = 'total' and match_producto = 'jazz' and tarifa_acceso = '2.0TD';

update formulas_indexadas set co_eur_mwh = 23
 where match_comercializadora = 'total' and match_producto = 'jazz' and tarifa_acceso = '3.0TD';

update formulas_indexadas set co_eur_mwh = 20
 where match_comercializadora = 'total' and match_producto = 'jazz' and tarifa_acceso = '6.1TD';

update formulas_indexadas set co_eur_mwh = 20, notas = coalesce(notas,'') || ' [CO 6.2TD aproximado: no está en la tabla de comisiones]'
 where match_comercializadora = 'total' and match_producto = 'jazz' and tarifa_acceso = '6.2TD';
