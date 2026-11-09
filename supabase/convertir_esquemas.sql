-- Convierte los esquemas de series antiguos al formato canónico (encargo B).
-- NO es una migración: se ejecuta una sola vez, a mano, en el SQL Editor.
-- Re-ejecutable: solo toca filas cuyo set_scheme sea exactamente un valor
-- antiguo de la tabla; la segunda vez no cambia nada.
--
-- Formato canónico: series separadas por "/", rango con guion dentro de
-- cada serie ("6-10/6-10/6-10/6-10", "10/10/10/10", "8/8/6").
-- La app ya interpreta los valores antiguos (src/lib/scheme.ts): esto solo
-- deja la base limpia para que la coach vea lo mismo en el editor.
--
-- Recuento previo (noviembre 2026):
--   '6-10/ 6-10/ 6-10 /6-10'  normal  2 filas  → '6-10/6-10/6-10/6-10'
--   '10-10-10-10'             normal  2 filas  → '10/10/10/10'

-- 1) Vista previa (no cambia nada)
with mapa(antes, despues) as (values
  ('6-10/ 6-10/ 6-10 /6-10', '6-10/6-10/6-10/6-10'),
  ('10-10-10-10',            '10/10/10/10')
)
select pe.id, pe.set_scheme as antes, m.despues
from program_exercises pe
join mapa m on pe.set_scheme = m.antes;

-- 2) Conversión (debería devolver 4 filas)
begin;
with mapa(antes, despues) as (values
  ('6-10/ 6-10/ 6-10 /6-10', '6-10/6-10/6-10/6-10'),
  ('10-10-10-10',            '10/10/10/10')
)
update program_exercises pe
set set_scheme = m.despues
from mapa m
where pe.set_scheme = m.antes
returning pe.id, m.antes, pe.set_scheme as despues;
commit;
