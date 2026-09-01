-- Mismo bug recurrente que empresas_pago: clientes no tenía grant completo a
-- service_role (solo detectado al intentar borrar un duplicado desde un
-- script de mantenimiento). Tercera tabla con este hueco en la misma sesión
-- — revisar si hace falta una auditoría general de grants en algún momento.
grant select, insert, update, delete on clientes to service_role;
