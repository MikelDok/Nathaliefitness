"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, CloudOff, Trophy, VideoOff } from "lucide-react";
import { CheckDot, ICON, PageHeader } from "@/components/ui";
import BodyMap from "@/components/BodyMapLazy";
import { viewOf, zonesOf } from "@/lib/muscles";
import { fmtNum } from "@/lib/progress";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { localDay } from "@/lib/dates";
import { parseScheme, schemeSummary, targetLabel } from "@/lib/scheme";
import { demo } from "@/lib/demo-data";
import { useRestTimer } from "@/lib/useRestTimer";
import RestTimer from "@/components/RestTimer";
import {
  clearDraft, flushDrafts, keepsDraft, pushLog, readDraft, signature, toSets, writeDraft,
  type LogSet, type SetRow,
} from "@/lib/logDraft";

/** Descanso cuando la entrenadora no ha indicado ninguno. */
const DEFAULT_REST = 90;
/** Espera tras editar reps/kg de una serie marcada antes de enviar. */
const EDIT_DELAY = 800;

type Status = "idle" | "saving" | "saved" | "offline";
type LogRow = { sets: LogSet[] | null; performed_at: string; note: string | null };

/** Objetivo de cada serie del esquema ("10", "6-10"; en cardio, el texto: una sola fila). */
function targetsOf(scheme: string): string[] {
  const p = parseScheme(scheme);
  return p.kind === "text" ? [p.text] : p.sets.map(targetLabel);
}

/**
 * Filas iniciales: una por serie del esquema. Fijas, con su número; rango,
 * con lo que hizo en esa serie la última sesión o, si no hay, el mínimo;
 * texto (cardio), vacía. El peso, el de la última sesión.
 */
function initialRows(scheme: string, prev: Map<number, LogSet>): SetRow[] {
  const p = parseScheme(scheme);
  if (p.kind === "text") return [{ reps: 0, kg: prev.get(1)?.kg ?? 0, done: false }];
  return p.sets.map((t, i) => {
    const last = prev.get(i + 1);
    const reps = t.min === t.max ? t.min : last?.reps || t.min;
    return { reps, kg: last?.kg ?? 0, done: false };
  });
}

/** Series de un registro por número (los antiguos no llevan `n`: cuenta su orden). */
function byNumber(sets: LogSet[] | null): Map<number, LogSet> {
  const m = new Map<number, LogSet>();
  (sets || []).forEach((s, i) => m.set(s.n ?? i + 1, s));
  return m;
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
  const [lastSets, setLastSets] = useState<LogSet[] | null>(null);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(isReal);
  const timer = useRestTimer(id);

  // Guardado automático. Los envíos son asíncronos: leen lo último de refs.
  const setsRef = useRef<SetRow[]>([]);
  const noteRef = useRef("");
  /** sesión y día del registro (fijo al abrir: no se parte a medianoche); null en demo */
  const ctx = useRef<{ uid: string; day: string } | null>(null);
  /** firma de lo que hay en Supabase */
  const savedSig = useRef("[]");
  const inFlight = useRef(false);
  const again = useRef(false);
  const editTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Deja el borrador local igual que la pantalla mientras Supabase no esté al día. */
  const persistDraft = useCallback((rows: SetRow[], text: string) => {
    const c = ctx.current;
    if (!c) return;
    if (signature(rows, text) !== savedSig.current || keepsDraft(rows, text)) {
      writeDraft({ peId: id, day: c.day, rows, note: text });
    } else clearDraft(id, c.day);
  }, [id]);

  /** Envía el estado actual; si ya hay un envío en marcha, repite al acabar. */
  const sync = useCallback(async function run(): Promise<void> {
    if (editTimer.current) { clearTimeout(editTimer.current); editTimer.current = null; }
    const c = ctx.current;
    const sb = getSupabase();
    if (!c || !sb) return;
    if (inFlight.current) { again.current = true; return; }
    const rows = setsRef.current, text = noteRef.current;
    const sig = signature(rows, text);
    if (sig === savedSig.current) {
      persistDraft(rows, text);
      setStatus((s) => (s === "offline" ? "saved" : s));
      return;
    }
    inFlight.current = true;
    setStatus("saving");
    const ok = await pushLog(sb, c.uid, { peId: id, day: c.day, rows, note: text });
    inFlight.current = false;
    if (ok) savedSig.current = sig;
    persistDraft(setsRef.current, noteRef.current);
    setStatus(ok ? "saved" : "offline");
    if (again.current) {
      again.current = false;
      if (ok) await run();
    }
  }, [id, persistDraft]);

  /** Aplica un cambio y decide cuándo enviarlo. */
  function commit(rows: SetRow[], text: string, send: "now" | "later" | "none") {
    setsRef.current = rows; noteRef.current = text;
    setSets(rows); setNote(text);
    if (!ctx.current) {
      // demo: todo en memoria
      if (!isReal && send !== "none") setStatus(toSets(rows).length ? "saved" : "idle");
      return;
    }
    persistDraft(rows, text);
    if (send === "now") void sync();
    else if (send === "later") {
      if (editTimer.current) clearTimeout(editTimer.current);
      editTimer.current = setTimeout(() => void sync(), EDIT_DELAY);
    }
  }

  // reintento al recuperar la conexión; al salir, lo que esté esperando se envía
  useEffect(() => {
    const onOnline = () => void sync();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      if (editTimer.current) void sync();
    };
  }, [sync]);

  useEffect(() => {
    ctx.current = null;
    savedSig.current = "[]";
    if (!isReal) {
      const k = demo.exercises.findIndex((e) => e.id === id);
      const ex = demo.exercises[k] ?? demo.exercises[0];
      const last = demo.lastLogs[ex.id];
      setName(ex.name); setMuscle(ex.muscle); setScheme(ex.scheme);
      setRest(ex.rest);
      setVideo(ex.video || null);
      setPr(last?.pr ?? null);
      setLastSets(last?.sets ?? null);
      setNext(k >= 0 && k < demo.exercises.length - 1 ? demo.exercises[k + 1].id : null);
      const rows = initialRows(ex.scheme, byNumber(last?.sets ?? null));
      setsRef.current = rows; noteRef.current = "";
      setSets(rows); setNote(""); setStatus("idle");
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    (async () => {
      const day = localDay();
      // getSession no necesita red: si se abre sin conexión, el borrador sigue funcionando
      const { data: { session } } = await sb.auth.getSession();
      const uid = session?.user.id ?? null;
      const { data: pe } = await sb
        .from("program_exercises")
        .select("id,program_id,week,day,set_scheme,set_type,rest_seconds,exercises(name,muscle_group,video_url)")
        .eq("id", id).maybeSingle();
      if (!pe) { setLoading(false); return; }
      const ex = pe.exercises as unknown as { name: string; muscle_group: string; video_url: string | null } | null;
      setName(ex?.name || "Ejercicio");
      setMuscle(ex?.muscle_group || "");
      setScheme(pe.set_scheme);
      setRest(pe.rest_seconds ?? null);
      setVideo(ex?.video_url || null);

      const [{ data: logs }, { data: dayRows }] = await Promise.all([
        sb.from("exercise_logs")
          .select("sets, performed_at, note")
          .eq("program_exercise_id", id)
          .order("performed_at", { ascending: false }),
        // para "Siguiente ejercicio": los visibles del mismo día, en orden
        sb.from("program_exercises").select("id")
          .eq("program_id", pe.program_id).eq("week", pe.week).eq("day", pe.day)
          .eq("hidden", false).order("position"),
      ]);
      const list = (logs as LogRow[]) || [];
      const maxKg = list.flatMap((l) => l.sets || []).reduce((m, s) => Math.max(m, s.kg || 0), 0);
      setPr(maxKg > 0 ? maxKg : null);
      // "Última sesión": la última anterior a hoy (la de hoy es la que se está haciendo)
      const last = list.find((l) => l.performed_at < day)?.sets ?? null;
      setLastSets(last?.length ? last : null);
      const ids = ((dayRows as { id: string }[]) || []).map((r) => r.id);
      const k = ids.indexOf(id);
      setNext(k >= 0 && k < ids.length - 1 ? ids[k + 1] : null);

      const prev = byNumber(last);
      let rows: SetRow[] = initialRows(pe.set_scheme, prev);
      let text = "";
      // si ya hay registro de hoy, se reconstruyen las series marcadas
      const todayLog = list.find((l) => l.performed_at === day);
      if (todayLog?.sets?.length) {
        byNumber(todayLog.sets).forEach((s, n) => {
          while (rows.length < n) rows.push({ reps: s.reps, kg: 0, done: false });
          rows[n - 1] = { reps: s.reps, kg: s.kg, done: true };
        });
        text = todayLog.note ?? "";
        savedSig.current = signature(rows, text);
      }
      // un borrador pendiente manda sobre lo guardado
      const draft = readDraft(id, day);
      if (draft) { rows = draft.rows; text = draft.note; }

      if (uid) ctx.current = { uid, day };
      setsRef.current = rows; noteRef.current = text;
      setSets(rows); setNote(text);
      setStatus(savedSig.current !== "[]" ? "saved" : "idle");
      setLoading(false);
      if (uid) {
        if (draft) void sync();
        void flushDrafts(sb, uid, { peId: id, day });
      }
    })();
  }, [id, isReal, sync]);

  const edit = (i: number, field: "reps" | "kg", v: number) => {
    const cur = setsRef.current;
    const rows = cur.map((s, j) => (j === i ? { ...s, [field]: v } : s));
    // solo las series marcadas van a Supabase
    commit(rows, noteRef.current, cur[i].done ? "later" : "none");
  };

  const restSec = rest ?? DEFAULT_REST;
  const targets = targetsOf(scheme);
  const nextIdx = sets.findIndex((s) => !s.done);
  const nextSet = nextIdx >= 0 ? nextIdx + 1 : null;

  /** ✓ de una serie: se guarda al momento; al marcarla arranca el descanso (en la última, no). */
  function checkSet(i: number) {
    timer.unlock(); // iOS: el audio se desbloquea dentro de un toque
    const marking = !setsRef.current[i].done;
    const rows = setsRef.current.map((s, j) => (j === i ? { ...s, done: !s.done } : s));
    commit(rows, noteRef.current, "now");
    if (!marking) return;
    const doneAfter = rows.filter((s) => s.done).length;
    if (doneAfter === rows.length) timer.complete();
    else timer.start(restSec, `tras la serie ${i + 1} de ${rows.length}`);
  }

  if (loading) {
    return <main className="mx-auto max-w-md px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)]"><p className="text-sm text-muted">Cargando ejercicio…</p></main>;
  }

  return (
    <main className="mx-auto max-w-md space-y-7 px-5 pb-[calc(env(safe-area-inset-bottom)+14rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <PageHeader back="/entreno" title={name}
        right={zonesOf(muscle).length > 0
          ? <BodyMap view={viewOf(muscle)} size={120} highlighted={zonesOf(muscle)} />
          : undefined}>
        {muscle} · {schemeSummary(scheme)} · descanso {restSec} s
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
        <div className="mb-2 flex min-h-5 items-center justify-between gap-3">
          <h2 className="eyebrow">Series</h2>
          <SaveStatus status={status} />
        </div>
        <div className="grid grid-cols-[20px_1fr_1fr_40px] items-center gap-3 border-b border-line pb-2">
          <span aria-hidden className="eyebrow">#</span>
          <span className="eyebrow">Repeticiones</span>
          <span className="eyebrow">Peso (kg)</span>
          <span className="sr-only">Hecho</span>
        </div>
        {sets.map((s, i) => (
          <div key={i} className="grid grid-cols-[20px_1fr_1fr_40px] items-end gap-3 border-b border-line py-2">
            {/* alineado por abajo: el objetivo va encima del campo de repeticiones */}
            <span className="figure flex h-12 items-center text-base text-muted">{i + 1}</span>
            <label className="block">
              <span className="mb-1 block text-center text-[11px] text-muted">
                {targets[i] ? <>Objetivo <span className="figure text-xs text-ink">{targets[i]}</span></> : " "}
              </span>
              <input type="number" inputMode="numeric" value={s.reps || ""}
                onChange={(e) => edit(i, "reps", +e.target.value)}
                placeholder={targets[i] ?? ""}
                aria-label={`Repeticiones serie ${i + 1}${targets[i] ? `, objetivo ${targets[i]}` : ""}`}
                className="field figure h-12 py-2.5 text-center text-lg" />
            </label>
            <input type="number" inputMode="decimal" step="0.5" value={s.kg || ""}
              onChange={(e) => edit(i, "kg", +e.target.value)}
              aria-label={`Peso serie ${i + 1}`}
              className="field figure h-12 py-2.5 text-center text-lg" />
            <button onClick={() => checkSet(i)} aria-pressed={s.done} aria-label={`Marcar serie ${i + 1}`}
              className="flex h-12 w-10 items-center justify-center">
              <CheckDot on={s.done} size={28} />
            </button>
          </div>
        ))}
        {lastSets && (
          <p className="mt-3 text-xs text-muted">
            Última sesión: {lastSets.map((s) => `${s.reps}×${fmtNum(s.kg)} kg`).join(" · ")}
          </p>
        )}
        <textarea value={note} onChange={(e) => commit(setsRef.current, e.target.value, "none")}
          onBlur={() => void sync()}
          placeholder="Añade una nota para tu entrenadora" rows={2}
          className="field mt-4" />
        <Link href={next ? `/ejercicio/${next}` : "/entreno"} className="btn-primary mt-4 w-full">
          {next
            ? <>Siguiente ejercicio <ChevronRight size={18} strokeWidth={2.25} aria-hidden /></>
            : "Volver al entreno"}
        </Link>
      </section>

      <RestTimer timer={timer} rest={restSec} nextSet={nextSet} />
    </main>
  );
}

/** Indicador discreto del guardado automático. */
function SaveStatus({ status }: { status: Status }) {
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-1 text-xs">
      {status === "saving" && <span className="text-muted">Guardando…</span>}
      {status === "saved" && (
        <span className="flex items-center gap-1 text-ok">
          <Check size={14} strokeWidth={2.5} aria-hidden /> Guardado
        </span>
      )}
      {status === "offline" && (
        <span className="flex items-center gap-1 text-danger">
          <CloudOff size={14} strokeWidth={2} aria-hidden /> Sin conexión, se guardará al volver
        </span>
      )}
    </p>
  );
}
