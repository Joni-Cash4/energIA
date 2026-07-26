-- Migración: contrato_id en facturas_contrato (ADR-0001, Fase 2).
-- Ejecutar en Supabase SQL Editor.
--
-- facturas_contrato es la tabla real de facturas archivadas (7 filas, PDF +
-- datos extraídos) — no la tabla `facturas` de init.sql, que apenas se usa
-- (1 fila, es más un registro de comparativa que una factura archivada).
--
-- Asignación revisada y confirmada A MANO por Jonathan (2026-07-26), no
-- automática: con solo 7 filas y tratándose de datos históricos del
-- negocio, se prioriza la exactitud sobre la automatización. Cada UPDATE de
-- abajo corresponde a una fila verificada individualmente contra los
-- contratos reales del cliente.

alter table facturas_contrato add column if not exists contrato_id uuid references contratos(id) on delete set null;
alter table facturas_contrato add column if not exists notas text;

create index if not exists facturas_contrato_contrato_idx on facturas_contrato (contrato_id);

-- Juan Carlos Hoyuelos, FELEC2600313169, abr 2026 — único contrato posible.
-- CASO ESPECIAL: el período de la factura (01-30 abr 2026) empieza unos días
-- antes de la fecha de alta registrada del contrato (21-abr-2026). Aceptado
-- como inconsistencia histórica de datos, no como error de modelado.
update facturas_contrato set
  contrato_id = '79a593f7-7422-4ca2-8e1d-6d7232e8c0f2',
  notas = 'contrato_id asignado y verificado a mano el 2026-07-26. El período de esta factura empieza unos días antes de la fecha de alta registrada del contrato — es el único contrato posible para este cliente/CUPS; se acepta como inconsistencia histórica de datos, no como error de modelado.'
  where id = '86662a13-be4e-491f-960a-003cc045e7a8';

-- Juan Carlos Hoyuelos, FELEC2600385882, may 2026 — mismo contrato, encaja bien.
update facturas_contrato set contrato_id = '79a593f7-7422-4ca2-8e1d-6d7232e8c0f2'
  where id = 'e6afc3f3-b15d-4736-88bf-64951435e075';

-- CCPP Enekuribidea 3, FELEC2600451359, jun 2026 — único contrato, encaja bien.
update facturas_contrato set contrato_id = '3cb2fb40-ce98-4b85-bba8-8b5541a574cc'
  where id = 'f9f9dd9b-00fe-460e-bb29-67b11ac9801d';

-- CDAD Garajes Enekuribidea 7-9, FELEC2600466702, jun 2026 — único contrato, encaja bien.
update facturas_contrato set contrato_id = '434bfda2-23b6-4390-8355-973f76c3c69a'
  where id = '21b7f142-8e5f-4003-a8a3-60c4db4774bc';

-- CDAD Garajes 3-4-5-6 Enekuribidea, FELEC2600466703, jun 2026 — el cliente
-- tiene 2 contratos (uno nuevo firmado 21-jul-2026, posterior al período de
-- esta factura); se asigna el contrato ANTIGUO, activo en junio 2026.
update facturas_contrato set contrato_id = '4f697104-fd91-4687-966b-c9f72362936d'
  where id = 'eb4a5c88-7b2e-41a4-a004-4e484c4820e3';

-- CCPP Fátima Etorbidea 6, FELEC2600443003, jun 2026 — único contrato, encaja bien.
update facturas_contrato set contrato_id = 'e5315bfd-b22f-4ea2-a7a3-34a20d1e5500'
  where id = 'a296ba30-68ee-4c68-a954-52270359bdac';

-- CCPP Enekurbidea 7, FELEC2600451361, jun 2026 — único contrato, encaja bien.
update facturas_contrato set contrato_id = '1b58ca58-f008-4e11-97ee-7bbbc8855e66'
  where id = '972ee426-81fc-4c13-98fe-2a11112d2e2d';
