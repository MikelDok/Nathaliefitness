"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { demo } from "@/lib/demo-data";
import { useRestTimer } from "@/lib/useRestTimer";
import RestTimer from "@/components/RestTimer";

/** Descanso cuando la entrenadora no ha indicado ninguno. */
const DEFAULT_REST = 90;

type SetRow = { reps: number; kg: number; done: boolean };

function parseScheme(s: string): number[] {
  if (s.includes("/")) return s.split("/").map((n) => parseInt(n) || 10);
  const m = s.match(/^(\d+)\s*[xX]\s*(\d+)$/);
  if (m) return Array(parseInt(m[1])).fill(parseInt(m[2]));
  return [10, 10, 10];
}

export default function Ejercicio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isReal = requireAuth && !id.startsWith("e");

  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState("");
  const [scheme, setScheme] = useState("");
  const [rest, setRest] = useState<number | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [pr, setPr] = useState<number | null>(null);
  const [lastSets, setLastSets] = useState<{ reps: number; kg: number }[] | null>(null);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(isReal);
  const timer = useRestTimer(id);

  useEffect(() => {
    if (!isReal) {
      const ex = demo.exercises.find((e) => e.id === id) ?? demo.exercises[0];
      const last = demo.lastLogs[ex.id];
      setName(ex.name); setMuscle(ex.muscle); setScheme(ex.scheme);
      setRest(ex.rest);
      setVideo(ex.video || null);
      setPr(last?.pr ?? null);
      setLastSets(last?.sets ?? null);
      setSets(parseScheme(ex.scheme).map((reps, i) => ({ reps, kg: last?.sets[i]?.kg ?? 0, done: false })));
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    (async () => {
      const { data: pe } = await sb
        .from("program_exercises")
        .select("id,set_scheme,set_type,rest_seconds,exercises(name,muscle_group,video_url)")
        .eq("id", id).maybeSingle();
      if (!pe) { setLoading(false); return; }
      const ex = pe.exercises as unknown as { name: string; muscle_group: string; video_url: string | null } | null;
      setName(ex?.name || "Ejercicio");
      setMuscle(ex?.muscle_group || "");
      setScheme(pe.set_scheme);
      setRest(pe.rest_seconds ?? null);
      setVideo(ex?.video_url || null);

      const { data: logs } = await sb
        .from("exercise_logs")
        .select("sets, performed_at")
        .eq("program_exercise_id", id)
        .order("performed_at", { ascending: false });

      const allSets = (logs || []).flatMap((l) => (l.sets as { reps: number; kg: number }[]) || []);
      const maxKg = allSets.reduce((m, s) => Math.max(m, s.kg || 0), 0);
      setPr(maxKg > 0 ? maxKg : null);
      const last = logs && logs[0] ? ((logs[0].sets as { reps: number; kg: number }[]) || null) : null;
      setLastSets(last);
      setSets(parseScheme(pe.set_scheme).map((reps, i) => ({ reps, kg: last?.[i]?.kg ?? 0, done: false })));
      setLoading(false);
    })();
  }, [id, isReal]);

  const update = (i: number, field: "reps" | "kg", v: number) =>
    setSets((s) => s.map((set, j) => (j === i ? { ...set, [field]: v } : set)));
  const toggle = (i: number) =>
    setSets((s) => s.map((set, j) => (j === i ? { ...set, done: !set.done } : set)));

  const restSec = rest ?? DEFAULT_REST;
  const nextIdx = sets.findIndex((s) => !s.done);
  const nextSet = nextIdx >= 0 ? nextIdx + 1 : null;

  /** ✓ de una serie: al marcarla arranca el descanso; en la última, no. */
  function checkSet(i: number) {
    timer.unlock(); // iOS: el audio se desbloquea dentro de un toque
    const marking = !sets[i].done;
    toggle(i);
    if (!marking) return;
    const doneAfter = sets.filter((s, j) => j === i || s.done).length;
    if (doneAfter === sets.length) timer.complete();
    else timer.start(restSec, `tras la serie ${i + 1} de ${sets.length}`);
  }

  async function save() {
    setErr(null);
    if (!isReal) { setSaved(true); return; }
    const sb = getSupabase();
    if (!sb) return;
    setSaving(true);
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from("exercise_logs").insert({
      client_id: u.user!.id,
      program_exercise_id: id,
      performed_at: new Date().toISOString().slice(0, 10),
      sets: sets.map(({ reps, kg }) => ({ reps, kg })),
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) { setErr("No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo."); return; }
    setSaved(true);
  }

  if (loading) {
    return <main className="mx-auto max-w-md px-4 pt-6"><p className="text-sm text-muted">Cargando ejercicio…</p></main>;
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-48 pt-4">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/entreno" aria-label="Volver" className="rounded-full border border-line p-2 text-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{name}</h1>
          <p className="text-xs text-muted">{muscle} · {scheme} · descanso {restSec} s</p>
        </div>
      </header>

      {video ? (
        <div className="card overflow-hidden">
          <iframe title={`Vídeo: ${name}`} src={video} className="aspect-video w-full"
            allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      ) : (
        <div className="card flex aspect-video items-center justify-center text-sm text-muted">
          Sin vídeo para este ejercicio
        </div>
      )}

      {pr !== null && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-raised px-4 py-3">
          <span className="eyebrow">Marca personal</span>
          <span className="figure text-lg">🏆 {pr} kg</span>
        </div>
      )}

      <section className="card mt-4 p-4">
        <div className="grid grid-cols-[24px_1fr_1fr_40px] items-center gap-3 text-xs text-muted">
          <span aria-hidden>#</span><span>Repeticiones</span><span>Peso (kg)</span><span className="sr-only">Hecho</span>
        </div>
        {sets.map((s, i) => (
          <div key={i} className="mt-2 grid grid-cols-[24px_1fr_1fr_40px] items-center gap-3">
            <span className="text-sm text-muted">{i + 1}</span>
            <input type="number" inputMode="numeric" value={s.reps || ""}
              onChange={(e) => update(i, "reps", +e.target.value)}
              aria-label={`Repeticiones serie ${i + 1}`}
              className="figure rounded-lg border border-line bg-bg px-3 py-2.5 text-center" />
            <input type="number" inputMode="decimal" step="0.5" value={s.kg || ""}
              onChange={(e) => update(i, "kg", +e.target.value)}
              aria-label={`Peso serie ${i + 1}`}
              className="figure rounded-lg border border-line bg-bg px-3 py-2.5 text-center" />
            <button onClick={() => checkSet(i)} aria-pressed={s.done} aria-label={`Marcar serie ${i + 1}`}
              className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm ${s.done ? "border-ok bg-ok/15 text-ok" : "border-line text-muted"}`}>
              ✓
            </button>
          </div>
        ))}
        {lastSets && (
          <p className="mt-3 text-xs text-muted">
            Última sesión: {lastSets.map((s) => `${s.reps}×${s.kg}kg`).join(" · ")}
          </p>
        )}
        <textarea value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Añade una nota para tu entrenadora" rows={2}
          className="mt-3 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />
        {err && <p className="mt-2 text-xs text-danger">{err}</p>}
        <button onClick={save} disabled={saving || saved}
          className="mt-3 w-full rounded-full bg-accent py-3 font-semibold text-accent-ink disabled:opacity-60">
          {saved ? "Guardado ✓" : saving ? "Guardando…" : "Guardar registro"}
        </button>
        {saved && isReal && (
          <p className="mt-2 text-center text-xs text-ok">Registro guardado en tu historial.</p>
        )}
      </section>

      <RestTimer timer={timer} rest={restSec} nextSet={nextSet} />
    </main>
  );
}
