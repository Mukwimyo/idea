create or replace function public.default_text_effect_settings()
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select '{"entryMode":"instant","entryMotion":"stationary","modifiers":[],"intensity":49,"irregularity":64,"letterSpacing":0,"speed":4,"autoAccelerate":true,"animate":true}'::jsonb;
$$;

alter table public.characters
  alter column text_effect_settings
  set default public.default_text_effect_settings();

update public.characters
set text_effect_settings = jsonb_set(text_effect_settings, '{entryMode}', '"instant"'::jsonb, true)
where text_effect_settings->>'entryMode' is distinct from 'instant';
