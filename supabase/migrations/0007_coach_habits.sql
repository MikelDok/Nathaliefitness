-- ============================================================
-- 0007 — La entrenadora puede crear/gestionar hábitos de sus
-- clientas (además de que cada clienta gestione los suyos).
-- Ejecutar en SQL Editor.
-- ============================================================

create policy "coach manages client habits" on habits
  for all using (is_coach_of(client_id))
  with check (is_coach_of(client_id));
