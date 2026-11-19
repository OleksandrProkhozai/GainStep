-- =====================================================================
-- Фото власних вправ.
--   exercises.image_path — шлях об'єкта в bucket exercise-images
--   ("<user id>/<uuid>.webp"); null — картинка за замовчуванням
--   (власна вправа — /exercises/custom-default.webp, системна — група м'язів).
--   Bucket exercise-images: публічне читання, запис лише у свою папку.
-- Ідемпотентна: можна запускати повторно.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. exercises.image_path
-- ---------------------------------------------------------------------
alter table public.exercises add column if not exists image_path text;

alter table public.exercises drop constraint if exists exercises_image_path_check;
alter table public.exercises
  add constraint exercises_image_path_check
  check (image_path is null or char_length(image_path) between 1 and 200);

-- ---------------------------------------------------------------------
-- 2. Bucket: публічний (картинки віддаються за public URL), до 2 МБ,
-- лише зображення. Клієнт перед завантаженням стискає фото до 512×512 webp.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-images', 'exercise-images', true, 2097152,
        array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 3. RLS на storage.objects: користувач працює лише з файлами у своїй
-- папці "<auth.uid()>/...". Читання для показу — через public URL.
-- ---------------------------------------------------------------------
drop policy if exists "exercise images: read own"   on storage.objects;
drop policy if exists "exercise images: insert own" on storage.objects;
drop policy if exists "exercise images: update own" on storage.objects;
drop policy if exists "exercise images: delete own" on storage.objects;

create policy "exercise images: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'exercise-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "exercise images: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'exercise-images'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "exercise images: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'exercise-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'exercise-images'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "exercise images: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'exercise-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

notify pgrst, 'reload schema';
