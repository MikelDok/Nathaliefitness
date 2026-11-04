"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { demo } from "@/lib/demo-data";

type Program = { id: string; title: string; weeks: number; days_per_week: number };
type Row = {
  id: string; week: number; day: number; position: number;
  set_scheme: string; set_type: string | null;
  exercises: { name: string; muscle_group: string } | null;
};

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
      <main className="space-y-5">
        <header>
          <p className="eyebrow">Entrenamiento</p>
          <h1 className="mt-1 text-2xl font-bold">{p.title}</h1>
        </header>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {p.weeks.map((w) => (
            <span key={w} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${w === p.currentWeek ? "bg-accent text-accent-ink" : "border border-line text-muted"}`}>Semana {w}</span>
          ))}
        </div>
        <ul className="space-y-3">
          {demo.exercises.map((e) => (
            <li key={e.id}>
              <Link href={`/ejercicio/${e.id}`} className="card flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{e.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{e.muscle} · {e.type} · {e.scheme}</p>
                </div>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm ${e.done ? "border-ok bg-ok/15 text-ok" : "border-line text-muted"}`}>{e.done ? "✓" : "›"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  // ---- Modo real ----
  if (loading) return <main><p className="text-sm text-muted">Cargando tu programa…</p></main>;

  if (!program) {
    return (
      <main className="space-y-5">
        <header>
          <p className="eyebrow">Entrenamiento</p>
          <h1 className="mt-1 text-2xl font-bold">Tu programa</h1>
        </header>
        <div className="card p-6 text-center">
          <p className="text-3xl" aria-hidden>🗓️</p>
          <p className="mt-2 text-sm">Tu entrenadora aún no te ha asignado un programa.</p>
          <p className="mt-1 text-xs text-muted">En cuanto lo cree, aparecerá aquí automáticamente.</p>
        </div>
      </main>
    );
  }

  const dayRows = rows.filter((r) => r.week === week && r.day === day).sort((a, b) => a.position - b.position);

  return (
    <main className="space-y-5">
      <header>
        <p className="eyebrow">Entrenamiento</p>
        <h1 className="mt-1 text-2xl font-bold">{program.title}</h1>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Semanas">
        {Array.from({ length: program.weeks }, (_, i) => i + 1).map((w) => (
          <button key={w} onClick={() => setWeek(w)} role="tab" aria-selected={w === week}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${w === week ? "bg-accent text-accent-ink" : "border border-line text-muted"}`}>
            Semana {w}
          </button>
        ))}
      </div>
      <div className="flex gap-2" role="tablist" aria-label="Días">
        {Array.from({ length: program.days_per_week }, (_, i) => i + 1).map((d) => (
          <button key={d} onClick={() => setDay(d)} role="tab" aria-selected={d === day}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${d === day ? "bg-raised" : "border border-line text-muted"}`}>
            Día {d}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted">{dayRows.length} ejercicios</p>

      {dayRows.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">Esta sesión aún no tiene ejercicios.</div>
      ) : (
        <ul className="space-y-3">
          {dayRows.map((r) => {
            const done = doneIds.has(r.id);
            return (
              <li key={r.id}>
                <Link href={`/ejercicio/${r.id}`} className="card flex items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.exercises?.name || "Ejercicio"}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {r.exercises?.muscle_group} · {r.set_type || "normal"} · {r.set_scheme}
                    </p>
                  </div>
                  <span aria-label={done ? "Completado hoy" : "Pendiente"}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm ${done ? "border-ok bg-ok/15 text-ok" : "border-line text-muted"}`}>
                    {done ? "✓" : "›"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
