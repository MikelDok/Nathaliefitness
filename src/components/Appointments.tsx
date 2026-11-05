"use client";

// Citas de un hilo (clientId). Lo usan la agenda de la clienta y la ficha de
// la entrenadora; asCoach solo decide qué columna de "visto" toca marcar.

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, MapPin, NotebookPen, Plus, Video, CalendarDays, CalendarX2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { EmptyState } from "@/components/ui";

const KIND_ICON = { presencial: MapPin, videollamada: Video, otro: CalendarDays } as const;
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
    const KindIcon = KIND_ICON[a.kind as keyof typeof KIND_ICON] ?? CalendarDays;
    const isLink = !!a.location && /^https?:\/\//.test(a.location);
    return (
      <li className="py-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className={`flex min-w-0 items-center gap-2 text-sm font-medium ${cancelled ? "text-muted line-through" : ""}`}>
            <KindIcon size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
            {a.title}
          </p>
          {cancelled && (
            <span className="chip min-h-6 shrink-0 bg-surface px-2.5 text-[10px]">Cancelada</span>
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
        {a.note && (
          <p className="mt-1 flex items-start gap-1.5 text-xs">
            <NotebookPen size={14} strokeWidth={1.75} aria-hidden className="mt-px shrink-0 text-muted" />
            {a.note}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1">
          <button onClick={() => downloadIcs(icsFilename(a.title), appointmentToIcs(a))}
            className="chip gap-1.5 bg-surface">
            <CalendarPlus size={14} strokeWidth={1.75} aria-hidden /> Añadir a mi calendario
          </button>
          {!cancelled && (
            <>
              <button onClick={() => startEdit(a)} disabled={busy}
                className="chip bg-surface disabled:opacity-60">
                Editar
              </button>
              <button onClick={() => cancel(a)} disabled={busy}
                className="chip bg-surface disabled:opacity-60">
                Cancelar
              </button>
            </>
          )}
        </div>
      </li>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
        <p className="eyebrow">Citas</p>
        <button onClick={() => { if (open) resetForm(); setOpen(!open); }}
          className={`chip shrink-0 gap-1 ${open ? "bg-surface" : "chip-active"}`}>
          {open ? "Cerrar" : <><Plus size={14} strokeWidth={2.25} aria-hidden /> Nueva cita</>}
        </button>
      </div>

      {open && (
        <div className="card mt-3 space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (p. ej. Sesión de fuerza)" aria-label="Título de la cita"
            className="field bg-raised" />
          <div className="flex flex-wrap gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Fecha"
              className="field min-w-0 flex-1 bg-raised" />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Hora"
              className="field min-w-0 flex-1 bg-raised" />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={duration} onChange={(e) => setDuration(+e.target.value)} aria-label="Duración"
              className="field min-w-0 flex-1 bg-raised">
              {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
            <select value={kind} onChange={(e) => setKind(e.target.value as AppointmentKind)} aria-label="Tipo"
              className="field min-w-0 flex-1 bg-raised">
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
          <input value={location} onChange={(e) => setLocation(e.target.value)}
            placeholder={kind === "videollamada" ? "Enlace de la videollamada" : "Lugar"}
            aria-label={kind === "videollamada" ? "Enlace de la videollamada" : "Lugar"}
            className="field bg-raised" />
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (opcional)" aria-label="Nota"
            className="field bg-raised" />
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="btn-primary">
              {busy ? "Guardando…" : editingId ? "Guardar cambios" : "Crear cita"}
            </button>
            {editingId && (
              <button onClick={() => { resetForm(); setOpen(false); }}
                className="chip min-h-11 bg-raised">
                Descartar
              </button>
            )}
          </div>
        </div>
      )}

      {err && <p className="mt-3 rounded-xl bg-danger/15 p-3 text-xs text-danger">{err}</p>}

      {loading ? (
        <p className="mt-3 text-sm text-muted">Cargando citas…</p>
      ) : upcoming.length === 0 ? (
        <EmptyState icon={CalendarX2}>No hay citas próximas. Crea la primera con “Nueva cita”.</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
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
