"use client";

// Citas de un hilo (clientId). Lo usan la agenda de la clienta y la ficha de
// la entrenadora; asCoach solo decide qué columna de "visto" toca marcar.

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import {
  APPOINTMENT_SELECT, KINDS, formatWhen, dateKey,
  type Appointment, type AppointmentKind,
} from "@/lib/agenda";
import { appointmentToIcs, downloadIcs, icsFilename } from "@/lib/ics";

const DURATIONS = [30, 45, 60, 90, 120];

export default function Appointments({ clientId, asCoach }: { clientId: string; asCoach: boolean }) {
  const [me, setMe] = useState("");
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(dateKey(new Date()));
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [kind, setKind] = useState<AppointmentKind>("presencial");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    const { data } = await sb.from("appointments").select(APPOINTMENT_SELECT)
      .eq("client_id", clientId).order("starts_at");
    setItems((data as unknown as Appointment[]) || []);
    setLoading(false);
    // al abrir la agenda, lo que hay deja de ser novedad para mí
    const col = asCoach ? "seen_by_coach_at" : "seen_by_client_at";
    await sb.from("appointments").update({ [col]: new Date().toISOString() })
      .eq("client_id", clientId).is(col, null);
  }, [clientId, asCoach]);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    sb.auth.getUser().then(({ data }) => setMe(data.user?.id || ""));
    load();
  }, [load]);

  function resetForm() {
    setEditingId(null); setTitle(""); setDate(dateKey(new Date())); setTime("10:00");
    setDuration(60); setKind("presencial"); setLocation(""); setNote("");
  }

  function startEdit(a: Appointment) {
    const d = new Date(a.starts_at);
    setEditingId(a.id);
    setTitle(a.title);
    setDate(dateKey(d));
    setTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    setDuration(a.duration_min);
    setKind(a.kind);
    setLocation(a.location || "");
    setNote(a.note || "");
    setOpen(true);
  }

  async function save() {
    setErr(null);
    if (!title.trim()) { setErr("Ponle un título a la cita."); return; }
    const starts = new Date(`${date}T${time}`);
    if (isNaN(starts.getTime())) { setErr("Revisa la fecha y la hora."); return; }
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    const now = new Date().toISOString();
    // quien toca la cita la da por vista; la otra parte recibe el aviso
    const payload = {
      client_id: clientId,
      title: title.trim(),
      kind,
      starts_at: starts.toISOString(),
      duration_min: duration,
      location: location.trim() || null,
      note: note.trim() || null,
      updated_at: now,
      seen_by_client_at: asCoach ? null : now,
      seen_by_coach_at: asCoach ? now : null,
    };
    const { error } = editingId
      ? await sb.from("appointments").update(payload).eq("id", editingId)
      : await sb.from("appointments").insert({ ...payload, created_by: me });
    setBusy(false);
    if (error) { setErr("No se pudo guardar la cita."); return; }
    resetForm(); setOpen(false); load();
  }

  async function cancel(a: Appointment) {
    setErr(null);
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await sb.from("appointments").update({
      status: "cancelada",
      updated_at: now,
      seen_by_client_at: asCoach ? null : now,
      seen_by_coach_at: asCoach ? now : null,
    }).eq("id", a.id);
    setBusy(false);
    if (error) { setErr("No se pudo cancelar la cita."); return; }
    load();
  }

  const now = Date.now();
  const upcoming = items.filter((a) => new Date(a.starts_at).getTime() >= now);
  const past = [...items].reverse().filter((a) => new Date(a.starts_at).getTime() < now);

  function Row({ a }: { a: Appointment }) {
    const cancelled = a.status === "cancelada";
    const k = KINDS.find((x) => x.value === a.kind);
    const isLink = !!a.location && /^https?:\/\//.test(a.location);
    return (
      <li className="py-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`min-w-0 text-sm font-medium ${cancelled ? "text-muted line-through" : ""}`}>
            {k?.icon} {a.title}
          </p>
          {cancelled && (
            <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-[10px] text-muted">Cancelada</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {formatWhen(a.starts_at)} · {a.duration_min} min · {k?.label}
        </p>
        {a.location && (
          <p className="mt-0.5 truncate text-xs">
            {isLink
              ? <a href={a.location} target="_blank" rel="noreferrer" className="text-accent underline">{a.location}</a>
              : <span className="text-muted">{a.location}</span>}
          </p>
        )}
        {a.note && <p className="mt-1 text-xs">📝 {a.note}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => downloadIcs(icsFilename(a.title), appointmentToIcs(a))}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">
            📅 Añadir a mi calendario
          </button>
          {!cancelled && (
            <>
              <button onClick={() => startEdit(a)} disabled={busy}
                className="rounded-full border border-line px-3 py-1.5 text-xs text-muted disabled:opacity-60">
                Editar
              </button>
              <button onClick={() => cancel(a)} disabled={busy}
                className="rounded-full border border-line px-3 py-1.5 text-xs text-muted disabled:opacity-60">
                Cancelar
              </button>
            </>
          )}
        </div>
      </li>
    );
  }

  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="eyebrow">Citas</p>
        <button onClick={() => { if (open) resetForm(); setOpen(!open); }}
          className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs">
          {open ? "Cerrar" : "＋ Nueva cita"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 rounded-xl bg-raised p-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (p. ej. Sesión de fuerza)" aria-label="Título de la cita"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />
          <div className="flex flex-wrap gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Fecha"
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm" />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Hora"
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={duration} onChange={(e) => setDuration(+e.target.value)} aria-label="Duración"
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm">
              {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
            <select value={kind} onChange={(e) => setKind(e.target.value as AppointmentKind)} aria-label="Tipo"
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm">
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.icon} {k.label}</option>)}
            </select>
          </div>
          <input value={location} onChange={(e) => setLocation(e.target.value)}
            placeholder={kind === "videollamada" ? "Enlace de la videollamada" : "Lugar"}
            aria-label={kind === "videollamada" ? "Enlace de la videollamada" : "Lugar"}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (opcional)" aria-label="Nota"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />
          <div className="flex gap-2">
            <button onClick={save} disabled={busy}
              className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-ink disabled:opacity-60">
              {busy ? "Guardando…" : editingId ? "Guardar cambios" : "Crear cita"}
            </button>
            {editingId && (
              <button onClick={() => { resetForm(); setOpen(false); }}
                className="rounded-full border border-line px-4 py-2 text-xs text-muted">
                Descartar
              </button>
            )}
          </div>
        </div>
      )}

      {err && <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">{err}</p>}

      {loading ? (
        <p className="mt-3 text-sm text-muted">Cargando citas…</p>
      ) : upcoming.length === 0 ? (
        <p className="mt-3 rounded-xl bg-raised p-4 text-sm text-muted">
          No hay citas próximas. Crea la primera con “＋ Nueva cita”.
        </p>
      ) : (
        <ul className="mt-1 divide-y divide-line">
          {upcoming.map((a) => <Row key={a.id} a={a} />)}
        </ul>
      )}

      {past.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted">
            Citas pasadas ({past.length})
          </summary>
          <ul className="mt-1 divide-y divide-line">
            {past.map((a) => <Row key={a.id} a={a} />)}
          </ul>
        </details>
      )}
    </section>
  );
}
