-- Migración: gestiones creadas desde nota de voz de Telegram
-- Ejecutar en Supabase SQL Editor

alter table gestiones add column if not exists origen text not null default 'manual'
  check (origen in ('manual','audio'));

alter table gestiones add column if not exists transcripcion text;

-- true cuando el matching automático de cliente no fue de confianza alta:
-- queda sin cliente_id (o con uno de baja confianza) y titular como texto libre,
-- pendiente de que Jonathan lo confirme a mano.
alter table gestiones add column if not exists revisar_cliente boolean not null default false;
