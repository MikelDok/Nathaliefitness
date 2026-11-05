"use client";

import { use, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useConfirm } from "@/lib/useConfirm";
import DeleteButton from "@/components/DeleteButton";
import { Check, Copy, Dumbbell, Eye, EyeOff, Plus } from "lucide-react";
import { EmptyState, ICON, PageHeader, chip } from "@/components/ui";
import { PLAN_SELECT, WEEKDAYS } from "@/lib/agenda";

type Program = {
  id: string; title: string; weeks: number; days_per_week: number;
  starts_on: string | null; weekdays: number[] | null;
};
type Exercise = { id: string; name: string; muscle_group: string };
type Row = {
  id: string; week: number; day: number; position: number; set_scheme: string;
  set_type: string | null; rest_seconds: number | null; hidden: boolean; exercise_id: string;
};

/** "" → null (la clienta usará 90 s); si no, segundos enteros ≥ 0. */
const parseRest = (v: string): number | null =>
  v.trim() === "" ? null : Math.max(0, Math.round(+v) || 0);

const types = ["normal", "calentamiento", "cardio", "superserie", "dropset"];

export default function Constructor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [program, setProgram] = useState<Program | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [week, setWeek] = useState(1);
  const [day, setDay] = useState(1);
  const [exId, setExId] = useState("");
  const [scheme, setScheme] = useState("8/8/6");
  const [type, setType] = useState("normal");
  const [rest, setRest] = useState("90");
  const [restSaved, setRestSaved] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const del = useConfirm(); // borrado con doble toque
  const [loading, setLoading] = useState(true);
  // planificación: fecha de inicio y qué día de la semana es cada Día N
  const [startsOn, setStartsOn] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [planMsg, setPlanMsg] = useState<string | null>(null);

  async function load() {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    const [{ data: p }, { data: ex }, { data: pe }] = await Promise.all([
      sb.from("programs").select(PLAN_SELECT).eq("id", id).maybeSingle(),
      sb.from("exercises").select("id,name,muscle_group").order("name"),
      sb.from("program_exercises").select("id,week,day,position,set_scheme,set_type,rest_seconds,hidden,exercise_id").eq("program_id", id).order("position"),
    ]);
    setProgram(p);
    setStartsOn(p?.starts_on || "");
    // por defecto lunes/miércoles/viernes…, que es lo más habitual
    setWeekdays(
      p?.weekdays?.length
        ? p.weekdays
        : Array.from({ length: p?.days_per_week || 3 }, (_, i) => Math.min(7, i * 2 + 1)),
    );
    setExercises(ex || []);
    setRows(pe || []);
    if (!exId && ex && ex.length) setExId(ex[0].id);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const dayRows = rows
    .filter((r) => r.week === week && r.day === day)
    .sort((a, b) => a.position - b.position);

  const exName = (eid: string) => exercises.find((e) => e.id === eid)?.name || "—";

  async function add() {
    setMsg(null);
    if (!exId) { setMsg("Añade primero ejercicios a la biblioteca."); return; }
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from("program_exercises").insert({
      program_id: id,
      exercise_id: exId,
      week, day,
      position: dayRows.length + 1,
      set_scheme: scheme.trim() || "3x10",
      set_type: type,
      rest_seconds: parseRest(rest),
    });
    if (error) { setMsg("No se pudo añadir."); return; }
    load();
  }

  async function remove(rowId: string) {
    if (!del.confirm(rowId)) return;
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("program_exercises").delete().eq("id", rowId);
    load();
  }

  /** Edición en línea del descanso de una fila; se guarda al salir del campo. */
  async function saveRest(row: Row, value: string) {
    const next = parseRest(value);
    if (next === row.rest_seconds) return;
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from("program_exercises").update({ rest_seconds: next }).eq("id", row.id);
    if (error) { setMsg("No se pudo guardar el descanso."); return; }
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, rest_seconds: next } : r)));
    setRestSaved(row.id);
    setTimeout(() => setRestSaved((cur) => (cur === row.id ? null : cur)), 1500);
  }

  /** Oculta o vuelve a mostrar un ejercicio en la app de la clienta. */
  async function toggleHidden(row: Row) {
    const sb = getSupabase();
    if (!sb) return;
    const next = !row.hidden;
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, hidden: next } : r)));
    const { error } = await sb.from("program_exercises").update({ hidden: next }).eq("id", row.id);
    if (error) {
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, hidden: row.hidden } : r)));
      setMsg("No se pudo cambiar la visibilidad.");
    }
  }

  /** Ancla el programa al calendario. Sin fecha de inicio, se desancla. */
  async function savePlan() {
    setPlanMsg(null);
    const sb = getSupabase();
    if (!sb || !program) return;
    const clean = weekdays.slice(0, program.days_per_week);
    const { error } = await sb.from("programs").update({
      starts_on: startsOn || null,
      weekdays: startsOn ? clean : null,
    }).eq("id", id);
    if (error) { setPlanMsg("No se pudo guardar la planificación."); return; }
    setPlanMsg(startsOn
      ? "Planificación guardada. La clienta ya ve sus entrenos en el calendario."
      : "Sin fecha de inicio: los entrenos no se anclan a fechas.");
    load();
  }

  async function copyWeekToNext() {
    setMsg(null);
    const sb = getSupabase();
    if (!sb || !program || week >= program.weeks) return;
    const source = rows.filter((r) => r.week === week);
    if (source.length === 0) { setMsg("Esta semana está vacía, nada que copiar."); return; }
    const target = rows.filter((r) => r.week === week + 1);
    if (target.length > 0) { setMsg(`La semana ${week + 1} ya tiene contenido.`); return; }
    const { error } = await sb.from("program_exercises").insert(
      source.map((r) => ({
        program_id: id, exercise_id: r.exercise_id, week: week + 1,
        day: r.day, position: r.position, set_scheme: r.set_scheme, set_type: r.set_type,
        rest_seconds: r.rest_seconds, hidden: r.hidden,
      }))
    );
    if (error) setMsg("No se pudo copiar la semana.");
    else { setMsg(`Semana ${week} copiada a la ${week + 1}.`); load(); }
  }

  if (loading) return <p className="text-sm text-muted">Cargando…</p>;
  if (!program) return <p className="text-sm text-muted">Programa no encontrado.</p>;

  return (
    <main className="space-y-8">
      <PageHeader back="/coach/programas" eyebrow="Constructor" title={program.title}>
        La clienta verá este programa en su pestaña Entreno al momento; no hay que “publicar”.
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        {/* ---------- Sesión ---------- */}
        <div className="min-w-0 space-y-5">
          <div className="space-y-2">
            <div className="-mx-5 flex gap-1 overflow-x-auto px-5 lg:mx-0 lg:px-0" role="tablist" aria-label="Semanas">
              {Array.from({ length: program.weeks }, (_, i) => i + 1).map((w) => (
                <button key={w} onClick={() => setWeek(w)} role="tab" aria-selected={w === week} className={chip(w === week)}>
                  Semana {w}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Días">
              {Array.from({ length: program.days_per_week }, (_, i) => i + 1).map((d) => (
                <button key={d} onClick={() => setDay(d)} role="tab" aria-selected={d === day} className={chip(d === day)}>
                  Día {d}
                </button>
              ))}
            </div>
          </div>

          <section>
            <p className="eyebrow border-b border-line pb-2">Semana {week} · Día {day} · {dayRows.length} ejercicios</p>
            {dayRows.length === 0 ? (
              <EmptyState icon={Dumbbell}>Sesión vacía. Añade el primer ejercicio.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {dayRows.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-2 py-3">
                    <span className="figure w-6 shrink-0 text-lg text-muted">{i + 1}</span>
                    <div className={`min-w-0 flex-1 ${r.hidden ? "opacity-50" : ""}`}>
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{exName(r.exercise_id)}</span>
                        {r.hidden && (
                          <span className="chip min-h-6 shrink-0 bg-surface px-2.5 text-[10px]">Oculto</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{r.set_type} · {r.set_scheme}</p>
                    </div>
                    <label className="flex shrink-0 items-center gap-1 text-xs text-muted">
                      <input key={`${r.id}-${r.rest_seconds}`} type="number" inputMode="numeric" min={0} step={15}
                        defaultValue={r.rest_seconds ?? ""} placeholder="90"
                        onBlur={(e) => saveRest(r, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        aria-label={`Descanso en segundos de ${exName(r.exercise_id)}`}
                        className="field figure w-16 px-2 py-1.5 text-center text-base" />
                      <span className={restSaved === r.id ? "text-ok" : ""}>s</span>
                      {restSaved === r.id && <Check size={14} strokeWidth={2.5} aria-label="Guardado" className="text-ok" />}
                    </label>
                    <button onClick={() => toggleHidden(r)} aria-pressed={r.hidden}
                      aria-label={`${r.hidden ? "Mostrar" : "Ocultar"} a la clienta: ${exName(r.exercise_id)}`}
                      title={r.hidden ? "Oculto para la clienta" : "Visible para la clienta"}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${r.hidden ? "bg-surface text-muted" : "text-ink"}`}>
                      {r.hidden ? <EyeOff {...ICON} /> : <Eye {...ICON} />}
                    </button>
                    <DeleteButton armed={del.pending === r.id} onClick={() => remove(r.id)}
                      label={`Quitar ${exName(r.exercise_id)} de la sesión`} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ---------- Lateral: añadir y planificar ---------- */}
        <div className="space-y-5">
          <section className="card space-y-3">
            <p className="eyebrow">Añadir a esta sesión</p>
            <select value={exId} onChange={(e) => setExId(e.target.value)} aria-label="Ejercicio"
              className="field bg-raised">
              {exercises.length === 0 && <option value="">Biblioteca vacía</option>}
              {exercises.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.muscle_group}</option>)}
            </select>
            <div className="flex gap-2">
              <input value={scheme} onChange={(e) => setScheme(e.target.value)}
                placeholder="Esquema (8/8/6, 3x12, 15 min…)" aria-label="Esquema de series"
                className="field min-w-0 flex-1 bg-raised" />
              <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo"
                className="field w-auto bg-raised">
                {types.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted">
              Descanso
              <input type="number" inputMode="numeric" min={0} step={15} value={rest}
                onChange={(e) => setRest(e.target.value)} placeholder="90"
                className="field figure w-20 bg-raised px-2 py-2 text-center text-base" />
              <span>s entre series</span>
            </label>
            {msg && <p className="text-xs text-accent">{msg}</p>}
            <button onClick={add} className="btn-primary w-full">
              <Plus size={18} strokeWidth={2.25} aria-hidden /> Añadir a la sesión
            </button>
            {week < program.weeks && (
              <button onClick={copyWeekToNext} className="chip w-full justify-center gap-1.5 bg-raised text-ink">
                <Copy size={14} strokeWidth={1.75} aria-hidden /> Copiar semana {week} a la {week + 1}
              </button>
            )}
          </section>

          <section className="card space-y-3">
            <p className="eyebrow">Planificación en el calendario (opcional)</p>
            <p className="text-xs text-muted">
              Con una fecha de inicio y el día de la semana de cada sesión, la clienta ve
              sus entrenos en su agenda y en Inicio le aparece qué le toca hoy.
            </p>
            <label className="flex flex-wrap items-center gap-2 text-xs text-muted">
              Empieza el
              <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)}
                className="field w-auto flex-1 bg-raised py-2" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: program.days_per_week }, (_, i) => i).map((i) => (
                <label key={i} className="flex items-center gap-2 text-xs text-muted">
                  <span className="eyebrow w-10 shrink-0">Día {i + 1}</span>
                  <select value={weekdays[i] ?? 1}
                    onChange={(e) => setWeekdays((w) => {
                      const next = [...w];
                      next[i] = +e.target.value;
                      return next;
                    })}
                    aria-label={`Día de la semana del Día ${i + 1}`}
                    className="field min-w-0 flex-1 bg-raised px-2 py-2">
                    {WEEKDAYS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <button onClick={savePlan} className="btn-primary w-full">Guardar planificación</button>
            {planMsg && <p className="text-xs text-accent">{planMsg}</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
