-- Migración: permitir origen 'texto' (mensajes de texto de Telegram, sin audio)
-- Ejecutar en Supabase SQL Editor

alter table gestiones drop constraint if exists gestiones_origen_check;
alter table gestiones add constraint gestiones_origen_check check (origen in ('manual','audio','texto'));
