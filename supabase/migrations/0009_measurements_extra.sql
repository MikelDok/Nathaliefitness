-- ============================================================
-- 0009 — Progreso ampliado: 4 medidas nuevas + nota por registro.
-- Sustituye el Excel de seguimiento de la entrenadora.
-- Todas nullable: la clienta rellena solo lo que le interese.
-- No toca RLS: las policies de measurements son a nivel de fila
-- (client_id = auth.uid() / is_coach_of) y ya cubren estas columnas.
-- Ejecutar en SQL Editor DESPUÉS de 0008.
-- ============================================================

alter table measurements
  add column if not exists arm_cm   numeric(5,1),   -- brazo
  add column if not exists thigh_cm numeric(5,1),   -- muslo
  add column if not exists calf_cm  numeric(5,1),   -- gemelo
  add column if not exists neck_cm  numeric(5,1),   -- cuello
  add column if not exists note     text;           -- nota del día

-- Nota: legs_cm queda como columna de legado. Nunca tuvo interfaz;
-- muslo y gemelo la sustituyen. Se sigue exportando si tuviera datos.
