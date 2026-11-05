-- 0015 · Guardado automático de series: un registro por clienta, ejercicio
-- del programa y día. La pantalla del ejercicio hace upsert sobre este índice.
-- Re-ejecutable.
--
-- Diagnóstico (opcional, antes de aplicar): duplicados que se van a resolver
--   select client_id, program_exercise_id, performed_at, count(*)
--   from exercise_logs group by 1, 2, 3 having count(*) > 1;

-- Si había varios registros del mismo ejercicio el mismo día (guardar dos
-- veces), se conserva el más reciente.
delete from exercise_logs a
using exercise_logs b
where a.client_id = b.client_id
  and a.program_exercise_id = b.program_exercise_id
  and a.performed_at = b.performed_at
  and (a.created_at, a.id) < (b.created_at, b.id);

create unique index if not exists exercise_logs_one_per_day
  on exercise_logs (client_id, program_exercise_id, performed_at);
