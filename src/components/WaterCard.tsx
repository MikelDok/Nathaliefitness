"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";

const GLASS = 250;          // ml por toque
const GOAL_STEP = 250;      // ajuste del objetivo
const GOAL_MIN = 500, GOAL_MAX = 6000; // igual que el check de profiles.water_goal_ml

/** Mismo criterio de "hoy" que hábitos y registros de entreno. */
const todayStr = () => new Date().toISOString().slice(0, 10);
const liters = (ml: number) =>
  (ml / 1000).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Agua de hoy en Inicio: +250 ml / −250 ml y objetivo configurable (2 L por defecto). */
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
    <section className="card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Agua de hoy</p>
        <button onClick={() => setEditGoal((e) => !e)} aria-expanded={editGoal}
          className="text-xs text-muted underline">
          Objetivo {liters(goal)} L
        </button>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-sm">
          <span className="figure text-2xl">{liters(ml)}</span>
          <span className="text-muted"> / {liters(goal)} L · {glasses} vaso{glasses === 1 ? "" : "s"}</span>
          {reached && <span className="ml-1 text-ok">✓</span>}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => change(-GLASS)} disabled={ml === 0}
            aria-label="Quitar 250 ml"
            className="rounded-full border border-line px-3 py-2 text-xs text-muted disabled:opacity-40">
            −250 ml
          </button>
          <button onClick={() => change(GLASS)} aria-label="Añadir 250 ml"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
            💧 +250 ml
          </button>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised" role="progressbar"
        aria-valuemin={0} aria-valuemax={goal} aria-valuenow={ml} aria-label="Agua de hoy">
        <div className={`h-full rounded-full transition-[width] ${reached ? "bg-ok" : "bg-accent"}`}
          style={{ width: `${pct}%` }} />
      </div>

      {editGoal && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-raised px-3 py-2">
          <span className="text-xs text-muted">Objetivo diario</span>
          <div className="flex items-center gap-2">
            <button onClick={() => changeGoal(-GOAL_STEP)} disabled={goal <= GOAL_MIN}
              aria-label="Bajar objetivo"
              className="h-8 w-8 rounded-full border border-line text-sm disabled:opacity-40">−</button>
            <span className="figure w-14 text-center text-sm">{liters(goal)} L</span>
            <button onClick={() => changeGoal(GOAL_STEP)} disabled={goal >= GOAL_MAX}
              aria-label="Subir objetivo"
              className="h-8 w-8 rounded-full border border-line text-sm disabled:opacity-40">+</button>
          </div>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
    </section>
  );
}
