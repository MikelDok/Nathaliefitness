"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import {
  SELECT, usedFields, toExportRows, formatDate, type Measurement,
} from "@/lib/measurements";
import TrendPanel from "@/components/progress/TrendPanel";
import LoadsPanel from "@/components/progress/LoadsPanel";
import { seriesOf, type LoadLog } from "@/lib/progress";

type Profile = {
  id: string; full_name: string; created_at: string; goals: string | null; water_goal_ml: number | null;
};
type CheckIn = {
  id: string; week_start: string;
  energy: number | null; sleep: number | null; hunger: number | null;
  stress: number | null; training_feel: number | null;
  difficulties: string | null; comments: string | null; coach_reply: string | null;
};
type Habit = { id: string; title: string; active: boolean; week: boolean[] };
type SharedPhoto = { id: string; taken_at: string; angle: string; storage_path: string; url?: string };
type Log = {
  id: string; performed_at: string; note: string | null;
  sets: { reps: number; kg: number }[];
  program_exercises: { exercises: { name: string } | null } | null;
};

export default function FichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabit, setNewHabit] = useState("");
  const [photos, setPhotos] = useState<SharedPhoto[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [pendingAppt, setPendingAppt] = useState(0);
  // agua de los últimos 7 días (ml por día, del más antiguo a hoy)
  const [water, setWater] = useState<number[]>([]);
  // histórico completo de cargas para la gráfica (la lista de abajo solo trae 15)
  const [loadLogs, setLoadLogs] = useState<LoadLog[]>([]);
  // notas privadas de la coach (tabla client_notes, la clienta no tiene acceso)
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState("");
  const [notesMsg, setNotesMsg] = useState<string | null>(null);

  async function load() {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    const [{ data: p }, { data: ci }, { data: lg }, { data: ms }, { data: ph },
           { count: unread }, { count: pending }, { data: nt }, { data: allLogs }] = await Promise.all([
      sb.from("profiles").select("id,full_name,created_at,goals,water_goal_ml").eq("id", id).maybeSingle(),
      sb.from("check_ins").select("*").eq("client_id", id).order("week_start", { ascending: false }),
      sb.from("exercise_logs")
        .select("id,performed_at,note,sets,program_exercises(exercises(name))")
        .eq("client_id", id)
        .order("performed_at", { ascending: false })
        .limit(15),
      sb.from("measurements").select(SELECT)
        .eq("client_id", id).order("measured_at"),
      sb.from("progress_photos").select("id,taken_at,angle,storage_path")
        .eq("client_id", id).eq("shared_with_coach", true)
        .order("taken_at", { ascending: false }).limit(6),
      // en este hilo solo escriben dos: lo que no es mío lo envió ella
      sb.from("messages").select("id", { count: "exact", head: true })
        .eq("client_id", id).eq("sender_id", id).is("read_at", null),
      // citas que ha creado o cambiado ella y yo aún no he visto
      sb.from("appointments").select("id", { count: "exact", head: true })
        .eq("client_id", id).eq("created_by", id).is("seen_by_coach_at", null),
      sb.from("client_notes").select("body").eq("client_id", id).maybeSingle(),
      sb.from("exercise_logs").select("performed_at,sets,program_exercises(exercises(name))")
        .eq("client_id", id),
    ]);
    type LoadRow = {
      performed_at: string; sets: { reps: number; kg: number }[] | null;
      program_exercises: { exercises: { name: string } | null } | null;
    };
    setLoadLogs(((allLogs as unknown as LoadRow[]) || []).map((l) => ({
      performed_at: l.performed_at, sets: l.sets, name: l.program_exercises?.exercises?.name ?? null,
    })));
    setNotes(nt?.body || "");
    setNotesSaved(nt?.body || "");
    setProfile(p);
    setCheckins((ci as CheckIn[]) || []);
    setLogs((lg as unknown as Log[]) || []);
    setMeasurements((ms as unknown as Measurement[]) || []);
    setUnreadChat(unread || 0);
    setPendingAppt(pending || 0);
    const shared = (ph as SharedPhoto[]) || [];
    if (shared.length) {
      const { data: signed } = await sb.storage
        .from("progress-photos")
        .createSignedUrls(shared.map((x) => x.storage_path), 3600);
      shared.forEach((x, i) => { x.url = signed?.[i]?.signedUrl ?? undefined; });
    }
    setPhotos(shared);

    const since = new Date(); since.setDate(since.getDate() - 6);
    const sinceStr = since.toISOString().slice(0, 10);
    const { data: hb } = await sb.from("habits").select("id,title,active")
      .eq("client_id", id).order("title");
    const ids = (hb || []).map((h) => h.id);
    const [{ data: hl }, { data: wl }] = await Promise.all([
      ids.length
        ? sb.from("habit_logs").select("habit_id,logged_on").in("habit_id", ids).gte("logged_on", sinceStr)
        : Promise.resolve({ data: [] as { habit_id: string; logged_on: string }[] }),
      sb.from("water_logs").select("logged_on,ml").eq("client_id", id).gte("logged_on", sinceStr),
    ]);
    const days: string[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(since); d.setDate(since.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    setHabits(((hb || []) as { id: string; title: string; active: boolean }[]).map((h) => ({
      ...h,
      week: days.map((d) => (hl || []).some((l) => l.habit_id === h.id && l.logged_on === d)),
    })));
    setWater(days.map((d) => (wl || []).find((w) => w.logged_on === d)?.ml ?? 0));
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function addHabit() {
    const t = newHabit.trim();
    if (!t) return;
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from("habits").insert({ client_id: id, title: t });
    if (error) { setMsg("No se pudo asignar el hábito (¿falta la migración 0007?)."); return; }
    setNewHabit(""); load();
  }

  /** Guarda las notas privadas al salir del campo. */
  async function saveNotes() {
    if (notes === notesSaved) return;
    setNotesMsg(null);
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from("client_notes").upsert(
      { client_id: id, body: notes, updated_at: new Date().toISOString() },
      { onConflict: "client_id" },
    );
    if (error) { setNotesMsg("No se pudieron guardar las notas."); return; }
    setNotesSaved(notes);
    setNotesMsg("Guardado ✓");
  }

  async function sendReply(checkinId: string) {
    setMsg(null);
    const text = (reply[checkinId] || "").trim();
    if (!text) return;
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb
      .from("check_ins")
      .update({ coach_reply: text, replied_at: new Date().toISOString() })
      .eq("id", checkinId);
    if (error) { setMsg("No se pudo enviar la respuesta."); return; }
    setReply((r) => ({ ...r, [checkinId]: "" }));
    load();
  }

  /** .xlsx con el historial completo: una fila por fecha, medidas + nota. */
  async function exportExcel() {
    if (!measurements.length) return;
    setExporting(true);
    // carga bajo demanda: SheetJS (~400 KB) solo se descarga al exportar,
    // no entra en el bundle que usan las clientas
    const XLSX = await import("xlsx");
    const rows = toExportRows(measurements);
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] || {}).map((k) => ({
      wch: k === "Nota" ? 40 : Math.max(12, k.length + 2),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Medidas");
    const slug = (profile?.full_name || "clienta").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    XLSX.writeFile(wb, `medidas-${slug}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    setExporting(false);
  }

  if (loading) return <p className="text-sm text-muted">Cargando ficha…</p>;
  if (!profile) return <p className="text-sm text-muted">Clienta no encontrada.</p>;

  const scores = (c: CheckIn) =>
    [["Energía", c.energy], ["Sueño", c.sleep], ["Hambre", c.hunger], ["Estrés", c.stress], ["Entreno", c.training_feel]] as const;

  return (
    <main className="space-y-6">
      <header className="flex items-center gap-3">
        <Link href="/coach" aria-label="Volver" className="rounded-full border border-line p-2 text-muted">←</Link>
        <div>
          <h1 className="text-xl font-bold">{profile.full_name}</h1>
          <p className="text-xs text-muted">
            Clienta desde {new Date(profile.created_at).toLocaleDateString("es-ES")}
          </p>
          <p className="mt-1 text-sm">
            <span className="text-muted">Objetivo: </span>
            {profile.goals || <span className="text-muted">sin indicar</span>}
          </p>
        </div>
      </header>

      <section className="card p-4">
        <label htmlFor="coach-notes" className="eyebrow">Notas privadas</label>
        <textarea id="coach-notes" value={notes} rows={3}
          onChange={(e) => { setNotes(e.target.value); setNotesMsg(null); }}
          onBlur={saveNotes}
          placeholder="Lesiones, preferencias, cosas a vigilar…"
          className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />
        <p className="mt-1 text-[11px] text-muted">
          Solo tú ves estas notas. Se guardan al salir del campo.
          {notesMsg && <span className={notesMsg.startsWith("No") ? " text-red-300" : " text-ok"}> {notesMsg}</span>}
        </p>
      </section>

      {msg && <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">{msg}</p>}

      <Link href={`/coach/clientes/${id}/agenda`}
        className="card flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="eyebrow">Agenda</p>
          <p className="mt-1 text-sm">
            {pendingAppt > 0
              ? `${pendingAppt} cita${pendingAppt > 1 ? "s" : ""} nueva${pendingAppt > 1 ? "s" : ""} o cambiada${pendingAppt > 1 ? "s" : ""}`
              : "Ver y crear citas"}
          </p>
        </div>
        {pendingAppt > 0 ? (
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-ink">
            {pendingAppt}
          </span>
        ) : (
          <span aria-hidden className="shrink-0 text-muted">›</span>
        )}
      </Link>

      <Link href={`/coach/clientes/${id}/chat`}
        className="card flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="eyebrow">Mensajes</p>
          <p className="mt-1 text-sm">
            {unreadChat > 0
              ? `${unreadChat} mensaje${unreadChat > 1 ? "s" : ""} sin leer`
              : "Abrir conversación"}
          </p>
        </div>
        {unreadChat > 0 ? (
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-ink">
            {unreadChat}
          </span>
        ) : (
          <span aria-hidden className="shrink-0 text-muted">›</span>
        )}
      </Link>

      <section className="card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="eyebrow">Progreso</p>
          {measurements.length > 0 && (
            <div className="flex shrink-0 gap-2">
              <button onClick={exportExcel} disabled={exporting}
                className="rounded-full border border-line px-3 py-1.5 text-xs text-muted disabled:opacity-60">
                {exporting ? "Generando…" : "⬇ Excel"}
              </button>
              <Link href={`/coach/clientes/${id}/informe`}
                className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">
                🖨 PDF
              </Link>
            </div>
          )}
        </div>
        {measurements.length === 0 ? (
          <p className="mt-3 rounded-xl bg-raised p-4 text-sm text-muted">
            Aún no ha registrado peso ni medidas.
          </p>
        ) : (
          (() => {
            const w = measurements.filter((m) => m.weight_kg != null);
            const first = w[0]?.weight_kg, last = w[w.length - 1]?.weight_kg;
            const lastWaist = [...measurements].reverse().find((m) => m.waist_cm != null)?.waist_cm;
            return (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {last != null && (
                  <p>Peso: <b className="figure">{last} kg</b>
                    {first != null && first !== last && (
                      <span className="text-muted"> (desde {first} kg, {last - first > 0 ? "+" : "−"}{Math.abs(last - first).toFixed(1)})</span>
                    )}
                  </p>
                )}
                {lastWaist != null && <p>Cintura: <b className="figure">{lastWaist} cm</b></p>}
                <p className="text-muted">{measurements.length} mediciones</p>
              </div>
            );
          })()
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line p-3">
            <p className="eyebrow">Peso</p>
            <TrendPanel points={seriesOf(measurements, "weight_kg")} name="Peso" unit="kg"
              showValue compact emptyText="Sin registros de peso." />
          </div>
          <div className="rounded-xl border border-line p-3">
            <p className="eyebrow">Cargas</p>
            <LoadsPanel logs={loadLogs} compact />
          </div>
        </div>
        {measurements.length > 0 && (() => {
          const cols = usedFields(measurements);
          const recent = [...measurements].reverse().slice(0, 12);
          return (
            <>
              {/* scroll horizontal: con 10 medidas no cabe en móvil */}
              <div className="mt-4 -mx-4 overflow-x-auto px-4">
                <table className="w-full min-w-max border-collapse text-left text-xs">
                  <thead>
                    <tr className="text-muted">
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      {cols.map((f) => (
                        <th key={f.key} className="py-2 pr-4 text-right font-medium">
                          {f.label} ({f.unit})
                        </th>
                      ))}
                      <th className="py-2 font-medium">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((m) => (
                      <tr key={m.id} className="border-t border-line">
                        <td className="whitespace-nowrap py-2 pr-4">{formatDate(m.measured_at)}</td>
                        {cols.map((f) => (
                          <td key={f.key} className="figure py-2 pr-4 text-right">{m[f.key] ?? "—"}</td>
                        ))}
                        <td className="min-w-[12rem] py-2 text-muted">{m.note || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {measurements.length > recent.length && (
                <p className="mt-2 text-[11px] text-muted">
                  Últimas {recent.length} de {measurements.length}. Exporta a Excel o PDF para verlas todas.
                </p>
              )}
            </>
          );
        })()}
        {photos.length > 0 && (
          <>
            <p className="mt-4 text-xs text-muted">Fotos que ha compartido contigo:</p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {photos.map((ph) => (
                <figure key={ph.id} className="overflow-hidden rounded-xl border border-line">
                  {ph.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ph.url} alt={`Foto ${ph.angle} del ${ph.taken_at}`} className="aspect-[3/4] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center bg-raised text-xs text-muted">…</div>
                  )}
                  <figcaption className="px-1 py-0.5 text-center text-[10px] text-muted">
                    {new Date(ph.taken_at).toLocaleDateString("es-ES")}
                  </figcaption>
                </figure>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="card p-4">
        <p className="eyebrow">Hábitos · últimos 7 días</p>
        {(() => {
          const goal = profile.water_goal_ml || 2000;
          const hit = water.filter((ml) => ml >= goal).length;
          return (
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm">
                💧 Agua <span className="text-xs text-muted">· obj. {(goal / 1000).toLocaleString("es-ES")} L</span>
              </span>
              <span className="flex shrink-0 gap-1" aria-label={`Objetivo de agua cumplido ${hit} de 7 días`}>
                {water.map((ml, i) => (
                  <span key={i} title={`${(ml / 1000).toLocaleString("es-ES")} L`}
                    className={`figure w-7 rounded py-0.5 text-center text-[10px] ${ml >= goal ? "bg-ok/15 text-ok" : ml > 0 ? "bg-raised" : "bg-raised text-muted"}`}>
                    {ml > 0 ? (ml / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 }) : "–"}
                  </span>
                ))}
              </span>
            </div>
          );
        })()}
        {habits.length === 0 ? (
          <p className="mt-3 rounded-xl bg-raised p-4 text-sm text-muted">Sin hábitos asignados.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {habits.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3">
                <span className={`min-w-0 truncate text-sm ${h.active ? "" : "text-muted line-through"}`}>{h.title}</span>
                <span className="flex shrink-0 gap-1" aria-label={`${h.week.filter(Boolean).length} de 7 días`}>
                  {h.week.map((done, i) => (
                    <span key={i} aria-hidden
                      className={`h-3 w-3 rounded-full ${done ? "bg-ok" : "bg-line"}`} />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex gap-2">
          <input value={newHabit} onChange={(e) => setNewHabit(e.target.value)}
            placeholder="Asignar hábito (p. ej. 10.000 pasos)"
            className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm" />
          <button onClick={addHabit}
            className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-ink">
            Asignar
          </button>
        </div>
      </section>

      <section className="card p-4">
        <p className="eyebrow">Check-ins</p>
        {checkins.length === 0 ? (
          <p className="mt-3 rounded-xl bg-raised p-4 text-sm text-muted">
            Todavía no ha enviado ningún check-in.
          </p>
        ) : (
          <ul className="mt-3 space-y-4">
            {checkins.map((c) => (
              <li key={c.id} className="rounded-xl border border-line p-3">
                <p className="text-xs font-semibold">
                  Semana del {new Date(c.week_start).toLocaleDateString("es-ES")}
                  {!c.coach_reply && (
                    <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">
                      Sin responder
                    </span>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {scores(c).map(([k, v]) => (
                    <span key={k}>{k}: <b className="text-ink">{v ?? "—"}/5</b></span>
                  ))}
                </div>
                {c.difficulties && <p className="mt-2 text-sm"><span className="text-muted">Dificultades:</span> {c.difficulties}</p>}
                {c.comments && <p className="mt-1 text-sm"><span className="text-muted">Comentarios:</span> {c.comments}</p>}
                {c.coach_reply ? (
                  <p className="mt-2 rounded-lg bg-raised p-2 text-sm">
                    <span className="text-muted">Tu respuesta:</span> {c.coach_reply}
                  </p>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={reply[c.id] || ""}
                      onChange={(e) => setReply((r) => ({ ...r, [c.id]: e.target.value }))}
                      placeholder="Escribe tu respuesta…"
                      className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm"
                    />
                    <button onClick={() => sendReply(c.id)}
                      className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-ink">
                      Responder
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <p className="eyebrow">Últimos entrenamientos registrados</p>
        {logs.length === 0 ? (
          <p className="mt-3 rounded-xl bg-raised p-4 text-sm text-muted">
            Aún no ha registrado ningún ejercicio.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {logs.map((l) => (
              <li key={l.id} className="py-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium">
                    {l.program_exercises?.exercises?.name || "Ejercicio"}
                  </p>
                  <span className="text-xs text-muted">
                    {new Date(l.performed_at).toLocaleDateString("es-ES")}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {(l.sets || []).map((s) => `${s.reps}×${s.kg}kg`).join(" · ")}
                </p>
                {l.note && <p className="mt-1 text-xs">📝 {l.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
