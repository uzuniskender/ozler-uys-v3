-- v16.72 — DevSync: Claude repo erişimi için dosya tablosu
CREATE TABLE IF NOT EXISTS public.uys_dev_files (
  path        text primary key,
  content     text not null,
  sha         text,
  size_bytes  int,
  updated_at  timestamptz default now(),
  updated_by  text default 'claude'
);
comment on table public.uys_dev_files is 'DevSync — repo dosyaları Claude erişimi için';
