"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarX2, ChevronRight, Dumbbell } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { demo } from "@/lib/demo-data";
import { CheckDot, EmptyState, ICON, PageHeader, chip } from "@/components/ui";

type Program = { id: string; title: string; weeks: number; days_per_week: number };
type Row = {
  id: string; week: number; day: number; position: number;
  set_scheme: string; set_type: string | null;
  exercises: { name: string; muscle_group: string } | null;
};

/** Fila plana de ejercicio: check, nombre en sans 500, detalle en muted. */
function ExerciseRow({ href, name, detail, done }: { href: string; name: string; detail: string; done: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-3 py-3.5"
      aria-label={`${name}${done ? " · completado hoy" : ""}`}>
      <CheckDot on={done} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{detail}</p>
      </div>
      <ChevronRight {...ICON} className="shrink-0 text-muted" />
    </Link>
  );
}

export default function Entreno() {
  const [program, setProgram] = useState<Program | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [week, setWeek] = useState(1);
  const [day, setDay] = useState(1);
  const [loading, setLoading] = useState(requireAuth);

  useEffect(() => {
    if (!requireAuth) return;
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    (async () => {
      const { data: u } = await sb.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { setLoading(false); return; }
      // el programa que la entrenadora ha marcado como activo; si no hay
      // ninguno (datos antiguos), cae al más reciente por created_at
      const { data: p } = await sb
        .from("programs")
        .select("id,title,weeks,days_per_week")
        .eq("client_id", uid)
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      if (!p) { setLoading(false); return; }
      setProgram(p);
      const [{ data: pe }, { data: logs }] = await Promise.all([
        sb.from("program_exercises")
          .select("id,week,day,position,set_scheme,set_type,exercises(name,muscle_group)")
          .eq("program_id", p.id).eq("hidden", false).order("position"),
        sb.from("exercise_logs")
          .select("program_exercise_id")
          .eq("client_id", uid)
          .eq("performed_at", new Date().toISOString().slice(0, 10)),
      ]);
      setRows((pe as unknown as Row[]) || []);
      setDoneIds(new Set((logs || []).map((l) => l.program_exercise_id)));
      setLoading(false);
    })();
  }, []);

  // ---- Modo demo ----
  if (!requireAuth) {
    const p = demo.program;
    return (
      <main className="space-y-7">
        <PageHeader eyebrow="Entrenamiento" title={p.title} />
        <div className="space-y-2">
          <div className="-mx-5 flex gap-1 overflow-x-auto px-5">
            {p.weeks.map((w) => (
              <span key={w} className={chip(w === p.currentWeek)}>Semana {w}</span>
            ))}
          </div>
          <div className="flex gap-1">
            {p.days.map((d) => (
              <span key={d} className={chip(d === p.currentDay)}>Día {d}</span>
            ))}
          </div>
        </div>
        <section>
          <p className="eyebrow border-b border-line pb-2">{demo.exercises.length} ejercicios</p>
          <ul className="divide-y divide-line">
            {demo.exercises.map((e) => (
              <li key={e.id}>
                <ExerciseRow href={`/ejercicio/${e.id}`} name={e.name}
                  detail={`${e.muscle} · ${e.type} · ${e.scheme}`} done={e.done} />
              </li>
            ))}
          </ul>
        </section>
      </main>
    );
  }

  // ---- Modo real ----
  if (loading) return <main><p className="text-sm text-muted">Cargando tu programa…</p></main>;

  if (!program) {
    return (
      <main className="space-y-7">
        <PageHeader eyebrow="Entrenamiento" title="Tu programa" />
        <EmptyState icon={CalendarX2}>
          Tu entrenadora aún no te ha asignado un programa. Aparecerá aquí en cuanto lo cree.
        </EmptyState>
      </main>
    );
  }

  const dayRows = rows.filter((r) => r.week === week && r.day === day).sort((a, b) => a.position - b.position);

  return (
    <main className="space-y-7">
      <PageHeader eyebrow="Entrenamiento" title={program.title} />

      <div className="space-y-2">
        <div className="-mx-5 flex gap-1 overflow-x-auto px-5" role="tablist" aria-label="Semanas">
          {Array.from({ length: program.weeks }, (_, i) => i + 1).map((w) => (
            <button key={w} onClick={() => setWeek(w)} role="tab" aria-selected={w === week} className={chip(w === week)}>
              Semana {w}
            </button>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Días">
          {Array.from({ length: program.days_per_week }, (_, i) => i + 1).map((d) => (
            <button key={d} onClick={() => setDay(d)} role="tab" aria-selected={d === day} className={chip(d === day)}>
              Día {d}
            </button>
          ))}
        </div>
      </div>

      {dayRows.length === 0 ? (
        <EmptyState icon={Dumbbell}>Esta sesión aún no tiene ejercicios.</EmptyState>
      ) : (
        <section>
          <p className="eyebrow border-b border-line pb-2">{dayRows.length} ejercicios</p>
          <ul className="divide-y divide-line">
            {dayRows.map((r) => (
              <li key={r.id}>
                <ExerciseRow href={`/ejercicio/${r.id}`} name={r.exercises?.name || "Ejercicio"}
                  detail={`${r.exercises?.muscle_group ?? ""} · ${r.set_type || "normal"} · ${r.set_scheme}`}
                  done={doneIds.has(r.id)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
