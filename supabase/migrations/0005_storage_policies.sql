-- ============================================================
-- 0005 — Seguridad del almacén de fotos (bucket progress-photos).
-- Cada clienta sube y ve SOLO su carpeta ({su_id}/...).
-- La entrenadora solo ve las fotos que la clienta marcó compartir.
-- Ejecutar en SQL Editor.
-- ============================================================

-- Subir: solo a tu propia carpeta
create policy "clients upload own photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'progress-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Ver: tus propias fotos
create policy "clients read own photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'progress-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Borrar: tus propias fotos
create policy "clients delete own photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'progress-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- La coach ve una foto SOLO si su clienta la marcó como compartida
create policy "coach reads shared photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'progress-photos'
  and exists (
    select 1 from public.progress_photos pp
    where pp.storage_path = name
      and pp.shared_with_coach
      and public.is_coach_of(pp.client_id)
  )
);
