-- =====================================================================
-- Фото власних програм.
--   programs.image_path — шлях об'єкта в bucket program-images
--   ("<user id>/<uuid>.webp"); null — картинка за замовчуванням
--   (копія шаблону — картинка шаблону, власна — /programs/custom-default.webp).
--   Bucket program-images: публічне читання, запис лише у свою папку.
-- Ідемпотентна: можна запускати повторно.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. programs.image_path
-- ---------------------------------------------------------------------
alter table public.programs add column if not exists image_path text;

alter table public.programs drop constraint if exists programs_image_path_check;
alter table public.programs
  add constraint programs_image_path_check
  check (image_path is null or char_length(image_path) between 1 and 200);

-- ---------------------------------------------------------------------
-- 2. Bucket: публічний, до 2 МБ, лише зображення
-- (клієнт стискає фото до 512×512 webp перед завантаженням).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('program-images', 'program-images', true, 2097152,
        array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 3. RLS: лише своя папка "<auth.uid()>/...". Показ — через public URL.
-- ---------------------------------------------------------------------
drop policy if exists "program images: read own"   on storage.objects;
drop policy if exists "program images: insert own" on storage.objects;
drop policy if exists "program images: update own" on storage.objects;
drop policy if exists "program images: delete own" on storage.objects;

create policy "program images: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'program-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "program images: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'program-images'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "program images: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'program-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'program-images'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "program images: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'program-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

notify pgrst, 'reload schema';
