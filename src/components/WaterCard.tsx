"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Droplet, Minus } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";

const GLASS = 250;          // ml por toque
const GOAL_STEP = 250;      // ajuste del objetivo
const GOAL_MIN = 500, GOAL_MAX = 6000; // igual que el check de profiles.water_goal_ml

/** Mismo criterio de "hoy" que hábitos y registros de entreno. */
const todayStr = () => new Date().toISOString().slice(0, 10);
const liters = (ml: number) =>
  (ml / 1000).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Agua de hoy en Inicio (fila plana): +250 ml / −250 ml y objetivo configurable (2 L por defecto). */
export default function WaterCard() {
  const [ml, setMl] = useState(0);
  const [goal, setGoal] = useState(2000);
  const [editGoal, setEditGoal] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const uidRef = useRef<string | null>(null);
  const mlRef = useRef(0); // valor más reciente, para toques seguidos

  useEffect(() => {
    if (!requireAuth) return;
    const sb = getSupabase();
    if (!sb) return;
    (async () => {
      const { data: u } = await sb.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      uidRef.current = uid;
      const [{ data: w }, { data: p }] = await Promise.all([
        sb.from("water_logs").select("ml").eq("client_id", uid).eq("logged_on", todayStr()).maybeSingle(),
        sb.from("profiles").select("water_goal_ml").eq("id", uid).maybeSingle(),
      ]);
      mlRef.current = w?.ml ?? 0;
      setMl(mlRef.current);
      if (p?.water_goal_ml) setGoal(p.water_goal_ml);
    })();
  }, []);

  async function change(delta: number) {
    setErr(null);
    const prev = mlRef.current;
    const next = Math.max(0, prev + delta);
    if (next === prev) return;
    mlRef.current = next;
    setMl(next);
    if (!requireAuth) return;
    const sb = getSupabase();
    if (!sb || !uidRef.current) return;
    const { error } = await sb.from("water_logs").upsert(
      { client_id: uidRef.current, logged_on: todayStr(), ml: next },
      { onConflict: "client_id,logged_on" },
    );
    if (error && mlRef.current === next) {
      mlRef.current = prev;
      setMl(prev);
      setErr("No se pudo guardar. Comprueba tu conexión.");
    }
  }

  async function changeGoal(delta: number) {
    const next = Math.min(GOAL_MAX, Math.max(GOAL_MIN, goal + delta));
    if (next === goal) return;
    const prev = goal;
    setGoal(next);
    if (!requireAuth) return;
    const sb = getSupabase();
    if (!sb || !uidRef.current) return;
    const { error } = await sb.from("profiles").update({ water_goal_ml: next }).eq("id", uidRef.current);
    if (error) { setGoal(prev); setErr("No se pudo cambiar el objetivo."); }
  }

  const glasses = Math.floor(ml / GLASS);
  const pct = Math.min(100, (ml / goal) * 100);
  const reached = ml >= goal;

  return (
    <section>
      <div className="flex items-center gap-3">
        <Droplet size={20} strokeWidth={1.75} aria-hidden className={reached ? "text-ok" : "text-muted"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="eyebrow">Agua</p>
            <button onClick={() => setEditGoal((e) => !e)} aria-expanded={editGoal}
              aria-label={`Objetivo ${liters(goal)} litros. Cambiar objetivo`}
              className="text-sm text-muted">
              <span className="figure text-base text-ink">{liters(ml)}</span> / {liters(goal)} L
              {reached && <Check size={14} strokeWidth={2.5} aria-label="Objetivo cumplido" className="ml-1 inline text-ok" />}
            </button>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar"
            aria-valuemin={0} aria-valuemax={goal} aria-valuenow={ml}
            aria-label={`Agua de hoy: ${glasses} vaso${glasses === 1 ? "" : "s"}`}>
            <div className={`h-full rounded-full transition-[width] ${reached ? "bg-ok" : "bg-accent"}`}
              style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={() => change(-GLASS)} disabled={ml === 0}
            aria-label="Quitar 250 ml"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-muted disabled:opacity-40">
            <Minus size={16} strokeWidth={1.75} aria-hidden />
          </button>
          <button onClick={() => change(GLASS)} aria-label="Añadir 250 ml"
            className="h-9 rounded-full bg-accent px-3 font-display text-xs font-bold uppercase tracking-[0.1em] text-accent-ink">
            + 250 ml
          </button>
        </div>
      </div>

      {editGoal && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2">
          <span className="text-xs text-muted">Objetivo diario</span>
          <div className="flex items-center gap-2">
            <button onClick={() => changeGoal(-GOAL_STEP)} disabled={goal <= GOAL_MIN}
              aria-label="Bajar objetivo"
              className="h-8 w-8 rounded-full bg-raised text-sm disabled:opacity-40">−</button>
            <span className="figure w-14 text-center text-sm">{liters(goal)} L</span>
            <button onClick={() => changeGoal(GOAL_STEP)} disabled={goal >= GOAL_MAX}
              aria-label="Subir objetivo"
              className="h-8 w-8 rounded-full bg-raised text-sm disabled:opacity-40">+</button>
          </div>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </section>
  );
}
