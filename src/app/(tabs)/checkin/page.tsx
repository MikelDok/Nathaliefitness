"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/ui";

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
    <main className="space-y-7">
      <PageHeader eyebrow="Check-in semanal" title={`Semana del ${weekLabel}`} />

      {submitted && (
        <p className="flex items-start gap-2 text-xs text-ok">
          <Check size={16} strokeWidth={2.5} aria-hidden className="shrink-0" />
          Check-in de esta semana enviado. Puedes editarlo y reenviarlo si quieres.
        </p>
      )}

      <section className="space-y-4">
        <ul className="divide-y divide-line border-y border-line">
        {fields.map((f) => (
          <li key={f.key} className="py-3.5">
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">{f.label}</p>
              <span className="figure text-[28px]">{values[f.key]}<span className="text-base text-muted">/5</span></span>
            </div>
            <input
              type="range" min={1} max={5} step={1}
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: +e.target.value }))}
              aria-label={f.label}
              className="range mt-2"
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted">
              <span>{f.low}</span><span>{f.high}</span>
            </div>
          </li>
        ))}
        </ul>

        <textarea value={difficulties} onChange={(e) => setDifficulties(e.target.value)}
          placeholder="¿Alguna dificultad esta semana? (opcional)" rows={2}
          className="field" />
        <textarea value={comments} onChange={(e) => setComments(e.target.value)}
          placeholder="Comentarios para tu entrenadora (opcional)" rows={2}
          className="field" />
        {err && <p className="text-xs text-danger">{err}</p>}
        <button onClick={submit} disabled={saving} className="btn-primary w-full">
          {saving ? "Enviando…" : submitted ? "Actualizar check-in" : "Enviar check-in"}
        </button>
      </section>

      {history.filter((c) => c.coach_reply).length > 0 && (
        <section>
          <p className="eyebrow border-b border-line pb-2">Respuestas de tu entrenadora</p>
          <ul className="divide-y divide-line">
            {history.filter((c) => c.coach_reply).map((c) => (
              <li key={c.id} className="py-3.5">
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
