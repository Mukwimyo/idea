alter table public.profiles
  add column if not exists font_scale numeric(3, 2) not null default 1.00
  check (font_scale between 0.80 and 1.30);
