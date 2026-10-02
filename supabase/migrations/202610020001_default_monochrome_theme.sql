alter table public.profiles
  alter column theme_id set default 'monochrome';

alter table public.rooms
  alter column shared_theme_id set default 'monochrome';
