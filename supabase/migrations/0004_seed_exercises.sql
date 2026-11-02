-- ============================================================
-- 0004 — Biblioteca inicial de ejercicios (OPCIONAL).
-- Crea 14 ejercicios básicos asignados a la entrenadora existente,
-- para no empezar de cero. Los vídeos se añaden luego desde el panel.
-- Ejecutar en SQL Editor. Se puede ejecutar solo una vez.
-- ============================================================

insert into public.exercises (coach_id, name, muscle_group)
select c.id, v.name, v.muscle
from (values
  ('Sentadilla (barra)',            'Cuádriceps'),
  ('Prensa',                        'Cuádriceps'),
  ('Zancadas (mancuernas)',         'Cuádriceps'),
  ('Curl femoral (tumbado)',        'Isquiotibial'),
  ('Peso muerto rumano',            'Isquiotibial'),
  ('Hip thrust',                    'Glúteos'),
  ('Búlgaras',                      'Glúteos'),
  ('Jalón al pecho',                'Espalda'),
  ('Remo en polea',                 'Espalda'),
  ('Press banca (mancuernas)',      'Pecho'),
  ('Press militar (mancuernas)',    'Hombros'),
  ('Plancha',                       'Core'),
  ('Calentamiento tren inferior',   'Movilidad'),
  ('Cardio suave',                  'Cardio')
) as v(name, muscle)
cross join (
  select id from public.profiles
  where role = 'coach'
  order by created_at
  limit 1
) as c;
