-- Restore neutral character spacing for newly sent messages. Historical message
-- snapshots remain immutable and keep the presentation used when they were sent.

create or replace function public.default_text_effect_settings()
returns jsonb
language sql
immutable
set search_path = pg_catalog, public
as $$
  select '{"entryMode":"jamo","entryMotion":"stationary","modifiers":[],"intensity":49,"irregularity":64,"letterSpacing":0,"speed":4,"autoAccelerate":true,"animate":true}'::jsonb;
$$;

alter table public.characters
  alter column text_effect_settings
  set default public.default_text_effect_settings();

update public.characters
set text_effect_settings = jsonb_set(text_effect_settings, '{letterSpacing}', '0'::jsonb, true)
where text_effect_settings->>'letterSpacing' = '-2';
