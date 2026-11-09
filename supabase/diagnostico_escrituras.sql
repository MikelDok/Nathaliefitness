-- ============================================================
-- Diagnóstico de escrituras (NO es una migración).
-- Pega todo en el SQL Editor de Supabase y pulsa Run.
--
-- Hace cada escritura de la app haciéndose pasar por la clienta y por
-- su coach (rol authenticated + su id), con la RLS, los permisos de
-- columna, los triggers y las restricciones reales.
--
-- NO DEJA NADA EN LA BASE:
--  · Cada prueba va en su propia subtransacción que termina SIEMPRE con
--    un error provocado, así que se deshace entera (también los ficheros
--    de Storage, que aquí son solo filas de storage.objects: no se sube
--    ningún archivo). Los textos de prueba llevan la marca __diag__.
--  · Realtime solo emite cambios confirmados: el chat no recibe nada.
--  · `diag` es una tabla TEMPORAL (solo existe en esta conexión, la API
--    no la ve) y se borra sola al terminar (on commit drop).
--  · No se crea ninguna función ni objeto permanente.
--  · Supabase avisa de "operaciones destructivas" porque el script
--    contiene update/delete: son las de la app (p. ej. desmarcar series
--    borra el registro) y se deshacen con su subtransacción.
--  · Comprobación final: compara una huella (md5) de cada tabla antes y
--    después de las pruebas y cuenta los restos con __diag__ (debe ser 0).
--
-- Cambia el correo si quieres probar con otra clienta.
-- ============================================================

create temp table diag (
  n serial, quien text, prueba text, resultado text, filas int, codigo text, mensaje text
) on commit drop;

do $$
declare
  correo constant text := 'clienta.prueba@local.es';
  M constant text := '__diag__';                       -- marca de los datos de prueba
  tablas constant text[] := array[
    'profiles','messages','exercise_logs','habits','habit_logs','water_logs','measurements',
    'progress_photos','check_ins','suggestions','appointments','client_notes','exercises',
    'programs','program_exercises','meal_plans','meals','faqs'];
  cl uuid; co uuid; pe uuid; hoy date := current_date;
  lunes date := date_trunc('week', current_date)::date;
  t jsonb := '[]';                                     -- lista de pruebas
  r jsonb; s text; c int; code text; msg text;
  antes jsonb := '{}'; despues jsonb := '{}'; tb text; h text; cambiadas text[] := '{}';
  restos int;
begin
  select u.id into cl from auth.users u where lower(u.email) = lower(correo);
  if cl is null then
    insert into diag (quien, prueba, resultado, mensaje)
    values ('-', 'Cuenta', 'FALLA', 'No existe ' || correo || ' en auth.users');
    return;
  end if;
  select p.coach_id into co from profiles p where p.id = cl;

  -- ---------- Datos de la cuenta ----------
  insert into diag (quien, prueba, resultado, mensaje)
  select '-', 'Perfil de la clienta',
    case when p.id is null then 'FALLA' when p.coach_id is null then 'AVISO' else 'OK' end,
    case when p.id is null then 'Sin fila en profiles'
         else format('role=%s, coach_id=%s, onboarded_at=%s', p.role, coalesce(p.coach_id::text, 'NULL'),
                     coalesce(p.onboarded_at::text, 'NULL')) end
  from (select 1) x left join profiles p on p.id = cl;

  insert into diag (quien, prueba, resultado, mensaje)
  select '-', 'Perfil de la coach', case when p.role = 'coach' then 'OK' else 'FALLA' end,
    coalesce(format('id=%s, role=%s', p.id, p.role), 'La clienta no tiene coach_id')
  from (select 1) x left join profiles p on p.id = co;

  insert into diag (quien, prueba, resultado, mensaje)
  select '-', 'Policies de messages', 'INFO',
    string_agg(format('%s [%s] using(%s) check(%s)', policyname, cmd, qual, with_check), ' | ')
  from pg_policies where schemaname = 'public' and tablename = 'messages';

  insert into diag (quien, prueba, resultado, mensaje)
  select '-', 'Permisos de authenticated en messages', 'INFO', string_agg(distinct privilege_type, ', ')
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'messages' and grantee = 'authenticated';

  insert into diag (quien, prueba, resultado, mensaje)
  select '-', 'Triggers en messages', 'INFO', coalesce(string_agg(tgname, ', '), 'ninguno')
  from pg_trigger where tgrelid = 'public.messages'::regclass and not tgisinternal;

  -- ejercicio del programa de la clienta (el activo primero)
  select pe2.id into pe from program_exercises pe2 join programs p on p.id = pe2.program_id
   where p.client_id = cl order by p.is_active desc, p.created_at desc limit 1;

  -- ---------- Huella de las tablas ANTES ----------
  foreach tb in array tablas loop
    execute format('select md5(coalesce(string_agg(x::text, %L order by x::text), %L)) from public.%I x', '|', '', tb) into h;
    antes := antes || jsonb_build_object(tb, h);
  end loop;
  execute $q$select md5(coalesce(string_agg(x::text, '|' order by x::text), ''))
            from storage.objects x where bucket_id in ('chat-media', 'progress-photos')$q$ into h;
  antes := antes || jsonb_build_object('storage.objects', h);

  -- ================= PRUEBAS COMO CLIENTA =================
  t := t || jsonb_build_object('q', 'clienta', 'u', cl, 'p', 'Chat: enviar texto', 's', jsonb_build_array(
    format($q$insert into messages (client_id, sender_id, kind, body) values (%L, %L, 'text', %L)$q$, cl, cl, M)));

  t := t || jsonb_build_object('q', 'clienta', 'u', cl, 'p', 'Chat: subir foto (storage chat-media)', 's', jsonb_build_array(
    format($q$insert into storage.objects (bucket_id, name) values ('chat-media', %L)$q$, cl || '/' || M || '.jpg')));

  if pe is null then
    insert into diag (quien, prueba, resultado, mensaje)
    values ('clienta', 'Series (guardado automático)', 'SIN DATOS', 'La clienta no tiene programa con ejercicios');
  else
    t := t || jsonb_build_object('q', 'clienta', 'u', cl, 'p', 'Series: primer ✓ (upsert)', 's', jsonb_build_array(
      format($q$insert into exercise_logs (client_id, program_exercise_id, performed_at, sets, note)
         values (%L, %L, %L, '[{"reps":10,"kg":20,"n":1}]', %L)
         on conflict (client_id, program_exercise_id, performed_at)
         do update set sets = excluded.sets, note = excluded.note$q$, cl, pe, hoy, M)));
    t := t || jsonb_build_object('q', 'clienta', 'u', cl, 'p', 'Series: editar (upsert sobre el existente)', 's', jsonb_build_array(
      format($q$insert into exercise_logs (client_id, program_exercise_id, performed_at, sets, note)
         values (%L, %L, %L, '[{"reps":10,"kg":20,"n":1}]', %L)
         on conflict (client_id, program_exercise_id, performed_at) do nothing$q$, cl, pe, hoy, M),
      format($q$insert into exercise_logs (client_id, program_exercise_id, performed_at, sets, note)
         values (%L, %L, %L, '[{"reps":8,"kg":22.5,"n":1}]', %L)
         on conflict (client_id, program_exercise_id, performed_at)
         do update set sets = excluded.sets, note = excluded.note$q$, cl, pe, hoy, M)));
    t := t || jsonb_build_object('q', 'clienta', 'u', cl, 'p', 'Series: desmarcar todas (borra el registro)', 's', jsonb_build_array(
      format($q$insert into exercise_logs (client_id, program_exercise_id, performed_at, sets, note)
         values (%L, %L, %L, '[{"reps":10,"kg":20,"n":1}]', %L)
         on conflict (client_id, program_exercise_id, performed_at) do nothing$q$, cl, pe, hoy, M),
      format($q$delete from exercise_logs where client_id = %L and program_exercise_id = %L and performed_at = %L$q$, cl, pe, hoy)));
  end if;

  t := t || jsonb_build_object('q', 'clienta', 'u', cl, 'p', 'Hábitos: crear y marcar hecho', 's', jsonb_build_array(
    format($q$insert into habits (client_id, title) values (%L, %L)$q$, cl, M),
    format($q$insert into habit_logs (habit_id, logged_on, done)
       select id, %L, true from habits where client_id = %L and title = %L
       on conflict (habit_id, logged_on) do update set done = excluded.done$q$, hoy, cl, M)));

  t := t || jsonb_build_object('q', 'clienta', 'u', cl, 'p', 'Agua: vaso (upsert)', 's', jsonb_build_array(
    format($q$insert into water_logs (client_id, logged_on, ml) values (%L, %L, 250)
       on conflict (client_id, logged_on) do update set ml = excluded.ml$q$, cl, hoy)));

  t := t || jsonb_build_object('q', 'clienta', 'u', cl, 'p', 'Agua: cambiar objetivo (profiles)', 's', jsonb_build_array(
    format($q$update profiles set water_goal_ml = 2500 where id = %L$q$, cl)));

  t := t || jsonb_build_object('q', 'clienta', 'u', cl, 'p', 'Medidas (upsert)', 's', jsonb_build_array(
    format($q$insert into measurements (client_id, measured_at, weight_kg, waist_cm, note) values (%L, %L, 60.5, 70, %L)
       on conflict (client_id, measured_at)
       do update set weight_kg = excluded.weight_kg, waist_cm = excluded.waist_cm, note = excluded.note$q$, cl, hoy, M)));

  t := t || jsonb_build_object('q', 'clienta', 'u', cl, 'p', 'Fotos: subir (storage progress-photos)', 's', jsonb_build_array(
    format($q$insert into storage.objects (bucket_id, name) values ('progress-photos', %L)$q$, cl || '/' || M || '-front.jpg')));

  t := t || jsonb_build_object('q', 'clienta', 'u', cl, 'p', 'Fotos: registrar (progress_photos)', 's', jsonb_build_array(
    format($q$insert into progress_photos (client_id, taken_at, angle, storage_path, shared_with_coach)
       values (%L, %L, 'front', %L, false)$q$, cl, hoy, cl || '/' || M || '-front.jpg')));

  t := t || jsonb_build_object('q', 'clienta', 'u', cl, 'p', 'Check-in semanal (upsert)', 's', jsonb_build_array(
    format($q$insert into check_ins (client_id, week_start, energy, sleep, hunger, stress, training_feel, difficulties, comments)
       values (%L, %L, 4, 3, 3, 2, 4, null, %L)
       on conflict (client_id, week_start) do update set energy = excluded.energy, sleep = excluded.sleep,
         hunger = excluded.hunger, stress = excluded.stress, training_feel = excluded.training_feel,
         difficulties = excluded.difficulties, comments = excluded.comments$q$, cl, lunes, M)));

  t := t || jsonb_build_object('q', 'clienta', 'u', cl, 'p', 'Objetivo (Perfil)', 's', jsonb_build_array(
    format($q$update profiles set goals = %L where id = %L$q$, M, cl)));

  t := t || jsonb_build_object('q', 'clienta', 'u', cl, 'p', 'Bienvenida: Empezar (profiles)', 's', jsonb_build_array(
    format($q$update profiles set goals = %L, water_goal_ml = 2000, onboarded_at = now() where id = %L$q$, M, cl)));

  t := t || jsonb_build_object('q', 'clienta', 'u', cl, 'p', 'Sugerencias: enviar', 's', jsonb_build_array(
    format($q$insert into suggestions (client_id, kind, body, screen) values (%L, 'idea', %L, 'Chat')$q$, cl, M)));

  t := t || jsonb_build_object('q', 'clienta', 'u', cl, 'p', 'Citas: crear y cancelar', 's', jsonb_build_array(
    format($q$insert into appointments (client_id, created_by, title, kind, starts_at, duration_min,
         updated_at, seen_by_client_at, seen_by_coach_at)
       values (%L, %L, %L, 'presencial', now() + interval '2 days', 60, now(), now(), null)$q$, cl, cl, M),
    format($q$update appointments set status = 'cancelada', updated_at = now(), seen_by_client_at = now(),
         seen_by_coach_at = null where client_id = %L and title = %L$q$, cl, M)));

  -- ================= PRUEBAS COMO COACH =================
  if co is null then
    insert into diag (quien, prueba, resultado, mensaje)
    values ('coach', 'Todas', 'SIN DATOS', 'La clienta no tiene coach_id: no hay coach que probar');
  else
    t := t || jsonb_build_object('q', 'coach', 'u', co, 'p', 'Chat: responder', 's', jsonb_build_array(
      format($q$insert into messages (client_id, sender_id, kind, body) values (%L, %L, 'text', %L)$q$, cl, co, M)));

    t := t || jsonb_build_object('q', 'coach', 'u', co, 'p', 'Chat: marcar leído',
      'prep', jsonb_build_array(
        format($q$insert into messages (client_id, sender_id, kind, body) values (%L, %L, 'text', %L)$q$, cl, cl, M)),
      's', jsonb_build_array(
        format($q$update messages set read_at = now() where client_id = %L and sender_id = %L and body = %L$q$, cl, cl, M)));

    t := t || jsonb_build_object('q', 'coach', 'u', co, 'p', 'Check-ins: responder',
      'prep', jsonb_build_array(
        format($q$insert into check_ins (client_id, week_start, energy) values (%L, %L, 3)
           on conflict (client_id, week_start) do nothing$q$, cl, lunes)),
      's', jsonb_build_array(
        format($q$update check_ins set coach_reply = %L, replied_at = now() where client_id = %L and week_start = %L$q$, M, cl, lunes)));

    t := t || jsonb_build_object('q', 'coach', 'u', co, 'p', 'Sugerencias: responder y cambiar estado',
      'prep', jsonb_build_array(
        format($q$insert into suggestions (client_id, kind, body) values (%L, 'idea', %L)$q$, cl, M)),
      's', jsonb_build_array(
        format($q$update suggestions set coach_reply = %L, status = 'leida' where client_id = %L and body = %L$q$, M, cl, M)));

    t := t || jsonb_build_object('q', 'coach', 'u', co, 'p', 'Notas privadas (upsert)', 's', jsonb_build_array(
      format($q$insert into client_notes (client_id, body, updated_at) values (%L, %L, now())
         on conflict (client_id) do update set body = excluded.body, updated_at = excluded.updated_at$q$, cl, M)));

    t := t || jsonb_build_object('q', 'coach', 'u', co, 'p', 'Hábitos de la clienta: crear', 's', jsonb_build_array(
      format($q$insert into habits (client_id, title) values (%L, %L)$q$, cl, M)));

    t := t || jsonb_build_object('q', 'coach', 'u', co, 'p', 'Citas: crear', 's', jsonb_build_array(
      format($q$insert into appointments (client_id, created_by, title, kind, starts_at, duration_min,
           updated_at, seen_by_client_at, seen_by_coach_at)
         values (%L, %L, %L, 'videollamada', now() + interval '3 days', 45, now(), null, now())$q$, cl, co, M)));

    t := t || jsonb_build_object('q', 'coach', 'u', co, 'p', 'Ejercicios: añadir a la biblioteca', 's', jsonb_build_array(
      format($q$insert into exercises (coach_id, name, muscle_group) values (%L, %L, 'Glúteos')$q$, co, M)));

    t := t || jsonb_build_object('q', 'coach', 'u', co, 'p', 'Programas: crear, añadir ejercicio, ocultar y activar', 's', jsonb_build_array(
      format($q$insert into exercises (coach_id, name, muscle_group) values (%L, %L, 'Glúteos')$q$, co, M),
      format($q$insert into programs (coach_id, client_id, title, weeks, days_per_week) values (%L, %L, %L, 4, 3)$q$, co, cl, M),
      format($q$insert into program_exercises (program_id, exercise_id, week, day, position, set_scheme, set_type, rest_seconds)
         select p.id, e.id, 1, 1, 1, '3x10', 'normal', 90
         from programs p, exercises e where p.title = %L and e.name = %L$q$, M, M),
      format($q$update program_exercises set hidden = true, rest_seconds = 60
         where program_id = (select id from programs where title = %L)$q$, M),
      format($q$select public.set_active_program((select id from programs where title = %L))$q$, M)));

    t := t || jsonb_build_object('q', 'coach', 'u', co, 'p', 'Planes de comida: crear, añadir comida y semanas', 's', jsonb_build_array(
      format($q$insert into meal_plans (coach_id, client_id, title, kcal_target) values (%L, %L, %L, 1800)$q$, co, cl, M),
      format($q$insert into meals (meal_plan_id, week, day, slot, name, kcal, protein_g, fat_g, carbs_g, ingredients)
         select id, 1, 1, 'desayuno', %L, 300, 20, 10, 30, '["avena 50 g"]' from meal_plans where title = %L$q$, M, M),
      format($q$update meal_plans set weeks = 2, starts_on = current_date where title = %L$q$, M)));

    t := t || jsonb_build_object('q', 'coach', 'u', co, 'p', 'FAQs: crear', 's', jsonb_build_array(
      format($q$insert into faqs (coach_id, question, answer, position) values (%L, %L, %L, 99)$q$, co, M, M)));
  end if;

  -- ================= EJECUCIÓN (cada prueba se deshace) =================
  for r in select * from jsonb_array_elements(t) loop
    c := 0;
    begin
      -- preparación como administrador (dentro de la misma subtransacción)
      for s in select jsonb_array_elements_text(coalesce(r->'prep', '[]')) loop execute s; end loop;
      -- a partir de aquí, como la app: rol authenticated con el id de la usuaria
      perform set_config('role', 'authenticated', true);
      perform set_config('request.jwt.claim.sub', r->>'u', true);
      perform set_config('request.jwt.claims',
        json_build_object('sub', r->>'u', 'role', 'authenticated')::text, true);
      for s in select jsonb_array_elements_text(r->'s') loop
        execute s;
        get diagnostics c = row_count;
      end loop;
      raise exception using errcode = 'P0001', message = 'NEA_OK';  -- deshace la prueba
    exception when others then
      -- aquí la subtransacción ya está deshecha y el rol vuelve a ser el administrador
      get stacked diagnostics code = returned_sqlstate, msg = message_text;
      if msg = 'NEA_OK' then
        insert into diag (quien, prueba, resultado, filas)
        values (r->>'q', r->>'p',
          case when c > 0 then 'OK' else 'NO GUARDA (0 filas: la RLS lo descarta sin error)' end, c);
      else
        insert into diag (quien, prueba, resultado, codigo, mensaje)
        values (r->>'q', r->>'p', 'FALLA', code, msg);
      end if;
    end;
  end loop;

  -- ================= COMPROBACIÓN: no queda nada =================
  foreach tb in array tablas loop
    execute format('select md5(coalesce(string_agg(x::text, %L order by x::text), %L)) from public.%I x', '|', '', tb) into h;
    despues := despues || jsonb_build_object(tb, h);
  end loop;
  execute $q$select md5(coalesce(string_agg(x::text, '|' order by x::text), ''))
            from storage.objects x where bucket_id in ('chat-media', 'progress-photos')$q$ into h;
  despues := despues || jsonb_build_object('storage.objects', h);
  select coalesce(array_agg(k), '{}') into cambiadas
    from jsonb_object_keys(antes) k where antes->>k is distinct from despues->>k;

  insert into diag (quien, prueba, resultado, mensaje)
  values ('-', 'Limpieza: huella de las tablas antes y después',
    case when cardinality(cambiadas) = 0 then 'OK' else 'FALLA' end,
    case when cardinality(cambiadas) = 0
         then format('Sin cambios en %s tablas', jsonb_array_length(to_jsonb(tablas)) + 1)
         else 'Han cambiado: ' || array_to_string(cambiadas, ', ') end);

  select (select count(*) from messages where body = M)
       + (select count(*) from habits where title = M)
       + (select count(*) from appointments where title = M)
       + (select count(*) from exercises where name = M)
       + (select count(*) from programs where title = M)
       + (select count(*) from meal_plans where title = M)
       + (select count(*) from meals where name = M)
       + (select count(*) from faqs where question = M)
       + (select count(*) from suggestions where body = M or coach_reply = M)
       + (select count(*) from check_ins where comments = M or coach_reply = M)
       + (select count(*) from client_notes where body = M)
       + (select count(*) from measurements where note = M)
       + (select count(*) from exercise_logs where note = M)
       + (select count(*) from profiles where goals = M)
       + (select count(*) from progress_photos where position(M in storage_path) > 0)
       + (select count(*) from storage.objects where position(M in name) > 0)
    into restos;
  insert into diag (quien, prueba, resultado, mensaje)
  values ('-', 'Limpieza: filas con la marca __diag__', case when restos = 0 then 'OK' else 'FALLA' end,
    restos || ' filas');
end $$;

select quien, prueba, resultado, filas, codigo, mensaje from diag order by n;
