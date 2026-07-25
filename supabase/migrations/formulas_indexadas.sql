-- Migración: catálogo de fórmulas de tarifas INDEXADAS, para que el validador
-- pueda comprobar el término de energía (el concepto más gordo de la factura).
-- Ejecutar en Supabase SQL Editor.
--
-- Una tarifa indexada no tiene precio publicado: tiene una fórmula cuyos
-- coeficientes se congelan al firmar y valen toda la duración del contrato.
-- Por eso el catálogo se indexa por VENTANA DE FIRMA, no por fecha de factura:
-- cada anexo trae sus coeficientes y aplica a quien firmó dentro de su vigencia.
--
-- Modelo soportado (TotalEnergies JAZZ, y cualquier otra con la misma forma):
--     precio_kWh = OMIE_periodo x Di + CMFi + ATRe
-- donde ATRe = peajes + cargos del BOE, que la web ya conoce (market-rates.ts).

create table if not exists formulas_indexadas (
  id                     uuid primary key default uuid_generate_v4(),
  etiqueta               text not null,   -- 'TotalEnergies JAZZ TE5 · anexo 5-19 may 2026'
  -- Coincidencia laxa contra el contrato: se compara en minúsculas por "contiene",
  -- porque la comercializadora se guarda de formas distintas ('TOTAL',
  -- 'TotalEnergies Electricidad y Gas España, S.A.U.'...).
  match_comercializadora text not null,   -- 'total'
  match_producto         text not null,   -- 'jazz'
  tarifa_acceso          text not null,   -- '2.0TD' | '3.0TD' | '6.1TD' | '6.2TD'
  firma_desde            date not null,   -- vigencia del anexo (ventana de firma)
  firma_hasta            date not null,
  di                     jsonb not null,  -- {"P1":1.194,...} coef. de pérdidas
  cmfi                   jsonb not null,  -- {"P1":0.046482,...} SIEMPRE en €/kWh
  activo                 boolean default true,
  notas                  text,
  created_at             timestamptz default now()
);

create index if not exists formulas_indexadas_match_idx
  on formulas_indexadas (match_comercializadora, tarifa_acceso, activo);

alter table formulas_indexadas enable row level security;

-- Es dato de catálogo (no de cliente): cualquier usuario autenticado lo lee.
drop policy if exists formulas_indexadas_read on formulas_indexadas;
create policy formulas_indexadas_read on formulas_indexadas
  for select using (auth.role() = 'authenticated');

grant select on formulas_indexadas to authenticated;
grant select, insert, update, delete on formulas_indexadas to service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: TotalEnergies JAZZ TE5
--
-- OJO CON LAS UNIDADES: TotalEnergies publica el CMFi en c€/kWh en el anexo de
-- mayo y en €/kWh en el de julio. Aquí SIEMPRE se guarda en €/kWh, así que los
-- valores de mayo van divididos entre 100. Confundirlos es un error de x100.
-- Los Di son idénticos en ambos anexos (es un coeficiente de pérdidas).
-- ─────────────────────────────────────────────────────────────────────────────

-- Anexo vigencia 5-19 mayo 2026 (CMFi original en c€/kWh, aquí ya en €/kWh)
insert into formulas_indexadas (etiqueta, match_comercializadora, match_producto, tarifa_acceso, firma_desde, firma_hasta, di, cmfi, notas) values
('TotalEnergies JAZZ TE5 · anexo 5-19 may 2026', 'total', 'jazz', '2.0TD', '2026-05-05', '2026-05-19',
 '{"P1":1.185,"P2":1.188,"P3":1.22}',
 '{"P1":0.055303,"P2":0.054749,"P3":0.057263}',
 'SRAD 2,19 €/MWh (subasta 01/01/2026-30/06/2026). CMFi original 5,5303 c€/kWh.'),
('TotalEnergies JAZZ TE5 · anexo 5-19 may 2026', 'total', 'jazz', '3.0TD', '2026-05-05', '2026-05-19',
 '{"P1":1.194,"P2":1.2,"P3":1.17,"P4":1.177,"P5":1.178,"P6":1.217}',
 '{"P1":0.046482,"P2":0.048026,"P3":0.045744,"P4":0.047801,"P5":0.051903,"P6":0.049696}',
 'SRAD 2,19 €/MWh (subasta 01/01/2026-30/06/2026). CMFi original 4,6482 c€/kWh.'),
('TotalEnergies JAZZ TE5 · anexo 5-19 may 2026', 'total', 'jazz', '6.1TD', '2026-05-05', '2026-05-19',
 '{"P1":1.088,"P2":1.087,"P3":1.076,"P4":1.079,"P5":1.066,"P6":1.102}',
 '{"P1":0.040886,"P2":0.042472,"P3":0.040791,"P4":0.042781,"P5":0.046223,"P6":0.044371}',
 'SRAD 2,19 €/MWh (subasta 01/01/2026-30/06/2026). CMFi original 4,0886 c€/kWh.'),
('TotalEnergies JAZZ TE5 · anexo 5-19 may 2026', 'total', 'jazz', '6.2TD', '2026-05-05', '2026-05-19',
 '{"P1":1.072,"P2":1.075,"P3":1.065,"P4":1.063,"P5":1.056,"P6":1.076}',
 '{"P1":0.040558,"P2":0.042136,"P3":0.040469,"P4":0.042457,"P5":0.045960,"P6":0.043811}',
 'SRAD 2,19 €/MWh (subasta 01/01/2026-30/06/2026). CMFi original 4,0558 c€/kWh.');

-- Anexo vigencia 21 jul - 4 ago 2026 (CMFi ya publicado en €/kWh)
insert into formulas_indexadas (etiqueta, match_comercializadora, match_producto, tarifa_acceso, firma_desde, firma_hasta, di, cmfi, notas) values
('TotalEnergies JAZZ TE5 · anexo 21 jul-4 ago 2026', 'total', 'jazz', '2.0TD', '2026-07-21', '2026-08-04',
 '{"P1":1.185,"P2":1.188,"P3":1.22}',
 '{"P1":0.027969,"P2":0.027278,"P3":0.027546}',
 'SRAD 0,00147 €/kWh (subasta 01/07/2026-31/12/2026). Suministro inicio 21/07/26-31/10/26.'),
('TotalEnergies JAZZ TE5 · anexo 21 jul-4 ago 2026', 'total', 'jazz', '3.0TD', '2026-07-21', '2026-08-04',
 '{"P1":1.194,"P2":1.2,"P3":1.17,"P4":1.177,"P5":1.178,"P6":1.217}',
 '{"P1":0.027050,"P2":0.026590,"P3":0.025868,"P4":0.025674,"P5":0.025726,"P6":0.026115}',
 'SRAD 0,00147 €/kWh (subasta 01/07/2026-31/12/2026). Suministro inicio 21/07/26-31/10/26.'),
('TotalEnergies JAZZ TE5 · anexo 21 jul-4 ago 2026', 'total', 'jazz', '6.1TD', '2026-07-21', '2026-08-04',
 '{"P1":1.088,"P2":1.087,"P3":1.076,"P4":1.079,"P5":1.066,"P6":1.102}',
 '{"P1":0.024023,"P2":0.023791,"P3":0.023529,"P4":0.023454,"P5":0.023244,"P6":0.023745}',
 'SRAD 0,00147 €/kWh (subasta 01/07/2026-31/12/2026). Suministro inicio 21/07/26-31/10/26.'),
('TotalEnergies JAZZ TE5 · anexo 21 jul-4 ago 2026', 'total', 'jazz', '6.2TD', '2026-07-21', '2026-08-04',
 '{"P1":1.072,"P2":1.075,"P3":1.065,"P4":1.063,"P5":1.056,"P6":1.076}',
 '{"P1":0.023662,"P2":0.023449,"P3":0.023181,"P4":0.023132,"P5":0.023009,"P6":0.023230}',
 'SRAD 0,00147 €/kWh (subasta 01/07/2026-31/12/2026). Suministro inicio 21/07/26-31/10/26.');


-- ─────────────────────────────────────────────────────────────────────────────
-- Datos del contrato de ANTONIO GARCIA CID-ADELA GARCIA CID
-- (CUPS ES0021000010009069HH). Tenía producto y fecha_firma a null, así que la
-- fórmula no se le podía enganchar. Ambos valores salen de su anexo de
-- renovación firmado (JAZZ, Mimetiz, 14 de mayo de 2026).
-- Si prefieres rellenarlos a mano desde el dashboard, salta este bloque.
-- ─────────────────────────────────────────────────────────────────────────────
update contratos
   set producto    = coalesce(producto, 'JAZZ TE5'),
       fecha_firma = coalesce(fecha_firma, '2026-05-14')
 where cups = 'ES0021000010009069HH';
