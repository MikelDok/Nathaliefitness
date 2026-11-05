"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, Dumbbell, MessageCircle, Salad, TrendingUp, type LucideIcon } from "lucide-react";
import { ICON, chip } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { demo } from "@/lib/demo-data";
import { fmtNum } from "@/lib/progress";
import {
  DEMO_WELCOME_KEY, WATER_OPTIONS, WELCOME_FEATURES, WELCOME_MESSAGE, WELCOME_PHOTO, WELCOME_SIGNATURE,
} from "@/lib/welcome";

const STEPS = 3;
const GOAL_MAX = 200;
/** Desplazamiento mínimo del dedo para cambiar de pantalla. */
const SWIPE = 50;
const ICONS: Record<(typeof WELCOME_FEATURES)[number]["key"], LucideIcon> = {
  entreno: Dumbbell, progreso: TrendingUp, comidas: Salad, chat: MessageCircle,
};

const firstName = (full: string) => full.trim().split(/\s+/)[0] || "";

/**
 * Bienvenida de la clienta: 3 pantallas a pantalla completa. Se muestra la
 * primera vez (AuthGate la envía aquí si profiles.onboarded_at está vacío) y
 * desde Perfil con ?repaso=1 (entonces no marca nada y vuelve a Perfil).
 */
export default function Bienvenida() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [replay, setReplay] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [water, setWater] = useState<number | null>(2000);
  const [step, setStep] = useState(0);
  const [drag, setDrag] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const titles = useRef<(HTMLHeadingElement | null)[]>([]);
  const touch = useRef<{ x: number; y: number; axis: "x" | "y" | null; dx: number } | null>(null);

  useEffect(() => {
    const again = new URLSearchParams(window.location.search).has("repaso");
    setReplay(again);
    if (!requireAuth) {
      setName(firstName(demo.client.name));
      setReady(true);
      return;
    }
    const sb = getSupabase();
    if (!sb) { setReady(true); return; }
    (async () => {
      const { data: s } = await sb.auth.getSession();
      const id = s.session?.user.id;
      if (!id) { router.replace("/login"); return; }
      const { data: p } = await sb.from("profiles")
        .select("role,full_name,goals,water_goal_ml,onboarded_at").eq("id", id).maybeSingle();
      if (p?.role === "coach") { router.replace("/coach"); return; }
      if (p?.onboarded_at && !again) { router.replace("/"); return; }
      setUid(id);
      setName(firstName(p?.full_name || ""));
      setGoal(p?.goals || "");
      const w = p?.water_goal_ml ?? 2000;
      setWater(WATER_OPTIONS.includes(w) ? w : null);
      setReady(true);
    })();
  }, [router]);

  // foco en el título de cada pantalla (también en la primera, al cargar)
  useEffect(() => {
    if (!ready) return;
    titles.current[step]?.focus({ preventScroll: true });
  }, [step, ready]);

  const go = (n: number) => { setErr(null); setStep(Math.max(0, Math.min(STEPS - 1, n))); };

  /** Saltar o terminar: deja constancia (salvo en el repaso) y sale. */
  async function finish(save: boolean) {
    setErr(null);
    const dest = replay ? "/perfil" : "/";
    if (!requireAuth) {
      try { sessionStorage.setItem(DEMO_WELCOME_KEY, "1"); } catch { /* nada */ }
      router.replace(dest);
      return;
    }
    const sb = getSupabase();
    if (!sb || !uid) { router.replace(dest); return; }
    const patch: Record<string, unknown> = {};
    if (save) {
      patch.goals = goal.trim().slice(0, GOAL_MAX) || null;
      if (water) patch.water_goal_ml = water;
    }
    if (!replay) patch.onboarded_at = new Date().toISOString();
    if (Object.keys(patch).length) {
      setBusy(true);
      const { error } = await sb.from("profiles").update(patch).eq("id", uid);
      setBusy(false);
      if (error) { setErr("No se pudo guardar. Inténtalo de nuevo."); return; }
    }
    router.replace(dest);
  }

  // ---- deslizar entre pantallas (solo gestos más horizontales que verticales) ----
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, axis: null, dx: 0 };
  }
  function onTouchMove(e: React.TouchEvent) {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (!s.axis && Math.abs(dx) + Math.abs(dy) > 8) s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (s.axis !== "x") return;
    // en los extremos, el arrastre ofrece resistencia
    const edge = (step === 0 && dx > 0) || (step === STEPS - 1 && dx < 0);
    s.dx = edge ? dx / 3 : dx;
    setDrag(s.dx);
  }
  function onTouchEnd() {
    const s = touch.current;
    touch.current = null;
    // se lee de la ref: el estado `drag` puede no estar al día al soltar
    if (s?.axis === "x") {
      if (s.dx <= -SWIPE) go(step + 1);
      else if (s.dx >= SWIPE) go(step - 1);
    }
    setDrag(0);
  }

  if (!ready) return null;

  const last = step === STEPS - 1;
  const offset = `calc(${-step * 100}% + ${drag}px)`;

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)", paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}>
      {/* ---------- Barra superior ---------- */}
      <div className="flex min-h-11 items-center justify-between px-3">
        <button onClick={() => go(step - 1)}
          className={`flex min-h-11 items-center gap-1 rounded-full pl-1 pr-3 text-sm text-muted ${step === 0 ? "invisible" : ""}`}>
          <ChevronLeft {...ICON} /> Atrás
        </button>
        <button onClick={() => void finish(false)} disabled={busy}
          className="min-h-11 rounded-full px-3 text-sm text-muted">
          Saltar
        </button>
      </div>

      {/* ---------- Pantallas ---------- */}
      <div className="relative min-h-0 flex-1 overflow-hidden"
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
        <div className={`flex h-full ${drag ? "" : "transition-transform duration-300 ease-out motion-reduce:transition-none"}`}
          style={{ transform: `translateX(${offset})` }}>
          {/* 1 · Hola */}
          <Panel active={step === 0}>
            <div className="flex justify-center pt-4">
              {WELCOME_PHOTO ? (
                <Image src={WELCOME_PHOTO} alt="Nathalie" width={160} height={160} priority
                  className="h-40 w-40 rounded-full object-cover" />
              ) : (
                <Image src="/logo.png" alt="NEA FITNESS" width={230} height={230} priority
                  className="logo-mark h-auto w-44" />
              )}
            </div>
            <h1 ref={(el) => { titles.current[0] = el; }} tabIndex={-1}
              className="mt-8 text-[40px] leading-none outline-none">
              Hola{name ? `, ${name}` : ""}
            </h1>
            <div className="mt-5 space-y-3 text-base leading-relaxed">
              {WELCOME_MESSAGE.map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <p className="eyebrow mt-5">— {WELCOME_SIGNATURE}</p>
          </Panel>

          {/* 2 · Lo que vas a encontrar */}
          <Panel active={step === 1}>
            <p className="eyebrow pt-4">Tu app</p>
            <h1 ref={(el) => { titles.current[1] = el; }} tabIndex={-1}
              className="mt-2 text-[32px] leading-none outline-none">
              Lo que vas a encontrar
            </h1>
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {WELCOME_FEATURES.map((f) => {
                const Icon = ICONS[f.key];
                return (
                  <li key={f.key} className="flex items-start gap-4 py-4">
                    <Icon {...ICON} className="mt-0.5 shrink-0 text-accent" />
                    <div className="min-w-0">
                      <p className="font-medium">{f.title}</p>
                      <p className="mt-0.5 text-sm text-muted">{f.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {/* 3 · Objetivo */}
          <Panel active={step === 2}>
            <p className="eyebrow pt-4">Para empezar</p>
            <h1 ref={(el) => { titles.current[2] = el; }} tabIndex={-1}
              className="mt-2 text-[32px] leading-none outline-none">
              ¿Cuál es tu objetivo?
            </h1>
            <p className="mt-3 text-sm text-muted">Los dos son opcionales: puedes cambiarlos cuando quieras en Perfil.</p>

            <label htmlFor="goal" className="eyebrow mt-6 block">Tu objetivo</label>
            <textarea id="goal" value={goal} maxLength={GOAL_MAX} rows={3}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Por ejemplo: ganar fuerza en las piernas y tener más energía"
              aria-describedby="goal-help"
              className="field mt-2" />
            <p id="goal-help" className="mt-1.5 text-xs text-muted">Tu entrenadora lo verá en tu ficha.</p>

            <p id="water-label" className="eyebrow mt-6">Agua al día</p>
            <div role="radiogroup" aria-labelledby="water-label" className="mt-2 flex flex-wrap gap-1.5">
              {WATER_OPTIONS.map((ml) => (
                <button key={ml} role="radio" aria-checked={water === ml} onClick={() => setWater(ml)}
                  className={`${chip(water === ml)} ${water === ml ? "" : "bg-surface"}`}>
                  {fmtNum(ml / 1000)} L
                </button>
              ))}
            </div>
            {err && <p role="alert" className="mt-4 text-sm text-danger">{err}</p>}
          </Panel>
        </div>
      </div>

      {/* ---------- Progreso y botón ---------- */}
      <div className="space-y-5 px-5 pt-4">
        <div className="flex justify-center gap-2" aria-hidden>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`h-2 rounded-full transition-all motion-reduce:transition-none ${i === step ? "w-6 bg-accent" : "w-2 bg-raised"}`} />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">Paso {step + 1} de {STEPS}</p>
        <button onClick={() => (last ? void finish(true) : go(step + 1))} disabled={busy}
          className="btn-primary w-full">
          {last ? (busy ? "Guardando…" : "Empezar") : "Siguiente"}
        </button>
      </div>
    </main>
  );
}

/** Una pantalla de la tira. Las que no se ven son inert (ni foco ni lector). */
function Panel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <section inert={!active} aria-hidden={!active}
      className="h-full w-full shrink-0 overflow-y-auto px-5 pb-4">
      {children}
    </section>
  );
}
