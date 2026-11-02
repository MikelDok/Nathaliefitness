"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";

type CheckIn = {
  id: string; week_start: string;
  energy: number | null; sleep: number | null; hunger: number | null;
  stress: number | null; training_feel: number | null;
  difficulties: string | null; comments: string | null;
  coach_reply: string | null;
};

const fields: { key: "energy" | "sleep" | "hunger" | "stress" | "training_feel"; label: string; low: string; high: string }[] = [
  { key: "energy", label: "Energía", low: "Agotada", high: "A tope" },
  { key: "sleep", label: "Sueño", low: "Muy malo", high: "Perfecto" },
  { key: "hunger", label: "Hambre", low: "Sin control", high: "Controlada" },
  { key: "stress", label: "Estrés", low: "Altísimo", high: "Tranquila" },
  { key: "training_feel", label: "Sensaciones entrenando", low: "Flojas", high: "Fuertes" },
];

function mondayOf(d: Date): string {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // lunes=0
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

export default function Checkin() {
  const week = mondayOf(new Date());
  const [values, setValues] = useState<Record<string, number>>({
    energy: 3, sleep: 3, hunger: 3, stress: 3, training_feel: 3,
  });
  const [difficulties, setDifficulties] = useState("");
  const [comments, setComments] = useState("");
  const [history, setHistory] = useState<CheckIn[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(requireAuth);

  useEffect(() => {
    if (!requireAuth) return;
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    (async () => {
      const { data: u } = await sb.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { setLoading(false); return; }
      const { data } = await sb
        .from("check_ins").select("*")
        .eq("client_id", uid)
        .order("week_start", { ascending: false });
      const list = (data as CheckIn[]) || [];
      setHistory(list);
      const current = list.find((c) => c.week_start === week);
      if (current) {
        setSubmitted(true);
        setValues({
          energy: current.energy ?? 3, sleep: current.sleep ?? 3,
          hunger: current.hunger ?? 3, stress: current.stress ?? 3,
          training_feel: current.training_feel ?? 3,
        });
        setDifficulties(current.difficulties || "");
        setComments(current.comments || "");
      }
      setLoading(false);
    })();
  }, [week]);

  async function submit() {
    setErr(null);
    if (!requireAuth) { setSubmitted(true); return; }
    const sb = getSupabase();
    if (!sb) return;
    setSaving(true);
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from("check_ins").upsert(
      {
        client_id: u.user!.id,
        week_start: week,
        ...values,
        difficulties: difficulties.trim() || null,
        comments: comments.trim() || null,
      },
      { onConflict: "client_id,week_start" }
    );
    setSaving(false);
    if (error) { setErr("No se pudo enviar. Inténtalo de nuevo."); return; }
    setSubmitted(true);
  }

  const weekLabel = new Date(week).toLocaleDateString("es-ES", { day: "numeric", month: "long" });

  if (loading) return <main><p className="text-sm text-muted">Cargando…</p></main>;

  return (
    <main className="space-y-5">
      <header>
        <p className="eyebrow">Check-in semanal</p>
        <h1 className="mt-1 text-2xl font-bold">Semana del {weekLabel}</h1>
      </header>

      {submitted && (
        <p className="rounded-xl bg-ok/10 p-3 text-xs text-ok">
          Check-in de esta semana enviado. Puedes editarlo y reenviarlo si quieres.
        </p>
      )}

      <section className="card space-y-4 p-4">
        {fields.map((f) => (
          <div key={f.key}>
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium">{f.label}</p>
              <span className="figure text-sm">{values[f.key]}/5</span>
            </div>
            <input
              type="range" min={1} max={5} step={1}
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: +e.target.value }))}
              aria-label={f.label}
              className="mt-1 w-full accent-[var(--color-accent)]"
            />
            <div className="flex justify-between text-[10px] text-muted">
              <span>{f.low}</span><span>{f.high}</span>
            </div>
          </div>
        ))}

        <textarea value={difficulties} onChange={(e) => setDifficulties(e.target.value)}
          placeholder="¿Alguna dificultad esta semana? (opcional)" rows={2}
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />
        <textarea value={comments} onChange={(e) => setComments(e.target.value)}
          placeholder="Comentarios para tu entrenadora (opcional)" rows={2}
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />
        {err && <p className="text-xs text-red-300">{err}</p>}
        <button onClick={submit} disabled={saving}
          className="w-full rounded-full bg-accent py-3 font-semibold text-accent-ink disabled:opacity-60">
          {saving ? "Enviando…" : submitted ? "Actualizar check-in" : "Enviar check-in"}
        </button>
      </section>

      {history.filter((c) => c.coach_reply).length > 0 && (
        <section className="card p-4">
          <p className="eyebrow">Respuestas de tu entrenadora</p>
          <ul className="mt-3 space-y-3">
            {history.filter((c) => c.coach_reply).map((c) => (
              <li key={c.id} className="rounded-xl bg-raised p-3">
                <p className="text-xs text-muted">
                  Semana del {new Date(c.week_start).toLocaleDateString("es-ES")}
                </p>
                <p className="mt-1 text-sm">{c.coach_reply}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
