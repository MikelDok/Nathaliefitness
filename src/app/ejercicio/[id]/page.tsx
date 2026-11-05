"use client";

import { use, useEffect, useState } from "react";
import { Check, Trophy, VideoOff } from "lucide-react";
import { CheckDot, ICON, PageHeader } from "@/components/ui";
import { fmtNum } from "@/lib/progress";
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
    return <main className="mx-auto max-w-md px-5 pt-6"><p className="text-sm text-muted">Cargando ejercicio…</p></main>;
  }

  return (
    <main className="mx-auto max-w-md space-y-7 px-5 pb-56 pt-6">
      <PageHeader back="/entreno" title={name}>
        {muscle} · {scheme} · descanso {restSec} s
      </PageHeader>

      {video ? (
        <div className="overflow-hidden rounded-[14px] bg-surface">
          <iframe title={`Vídeo: ${name}`} src={video} className="aspect-video w-full"
            allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-[14px] bg-surface text-sm text-muted">
          <VideoOff size={32} strokeWidth={1.5} aria-hidden />
          Sin vídeo para este ejercicio
        </div>
      )}

      {pr !== null && (
        <div className="flex items-center gap-3 border-y border-line py-3">
          <Trophy {...ICON} className="shrink-0 text-accent" />
          <span className="eyebrow flex-1">Marca personal</span>
          <span className="figure text-[32px]">{fmtNum(pr)}<span className="ml-1 text-base text-muted">KG</span></span>
        </div>
      )}

      <section>
        <div className="grid grid-cols-[20px_1fr_1fr_40px] items-center gap-3 border-b border-line pb-2">
          <span aria-hidden className="eyebrow">#</span>
          <span className="eyebrow">Repeticiones</span>
          <span className="eyebrow">Peso (kg)</span>
          <span className="sr-only">Hecho</span>
        </div>
        {sets.map((s, i) => (
          <div key={i} className="grid grid-cols-[20px_1fr_1fr_40px] items-center gap-3 border-b border-line py-2">
            <span className="figure text-base text-muted">{i + 1}</span>
            <input type="number" inputMode="numeric" value={s.reps || ""}
              onChange={(e) => update(i, "reps", +e.target.value)}
              aria-label={`Repeticiones serie ${i + 1}`}
              className="field figure py-2.5 text-center text-lg" />
            <input type="number" inputMode="decimal" step="0.5" value={s.kg || ""}
              onChange={(e) => update(i, "kg", +e.target.value)}
              aria-label={`Peso serie ${i + 1}`}
              className="field figure py-2.5 text-center text-lg" />
            <button onClick={() => checkSet(i)} aria-pressed={s.done} aria-label={`Marcar serie ${i + 1}`}
              className="flex h-10 w-10 items-center justify-center">
              <CheckDot on={s.done} size={28} />
            </button>
          </div>
        ))}
        {lastSets && (
          <p className="mt-3 text-xs text-muted">
            Última sesión: {lastSets.map((s) => `${s.reps}×${fmtNum(s.kg)} kg`).join(" · ")}
          </p>
        )}
        <textarea value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Añade una nota para tu entrenadora" rows={2}
          className="field mt-4" />
        {err && <p className="mt-2 text-xs text-danger">{err}</p>}
        <button onClick={save} disabled={saving || saved} className="btn-primary mt-4 w-full">
          {saved ? <><Check size={18} strokeWidth={2.5} aria-hidden /> Guardado</> : saving ? "Guardando…" : "Guardar registro"}
        </button>
        {saved && isReal && (
          <p className="mt-2 text-center text-xs text-ok">Registro guardado en tu historial.</p>
        )}
      </section>

      <RestTimer timer={timer} rest={restSec} nextSet={nextSet} />
    </main>
  );
}
