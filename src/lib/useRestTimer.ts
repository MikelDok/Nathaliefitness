"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Temporizador de descanso entre series.
 *
 * El tiempo se calcula siempre a partir de una marca de fin (`endAt`), no
 * contando intervalos: si la clienta bloquea el móvil o cambia de app, al
 * volver el tiempo restante es el correcto. La marca se guarda en
 * sessionStorage por ejercicio para sobrevivir a la recarga de la pestaña
 * que iOS hace a veces al volver de otra app.
 */

export type RestPhase = "idle" | "running" | "done" | "complete";

type Stored = { endAt: number; total: number; label: string; notified: boolean };

const SOUND_KEY = "nea:timer-sound";
const storeKey = (id: string) => `nea:rest:${id}`;
/** Pasado este tiempo desde el final, un descanso guardado ya no se muestra. */
const STALE_MS = 10 * 60 * 1000;

type WakeLockLike = { release: () => Promise<void> };
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> };
};

export function useRestTimer(id: string) {
  const [phase, setPhase] = useState<RestPhase>("idle");
  const [endAt, setEndAt] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [label, setLabel] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [soundOn, setSoundOn] = useState(true);

  const audioRef = useRef<AudioContext | null>(null);
  const wakeRef = useRef<WakeLockLike | null>(null);
  const notifiedRef = useRef(false);

  // ---------- persistencia ----------
  const persist = useCallback((data: Stored | null) => {
    try {
      if (data) sessionStorage.setItem(storeKey(id), JSON.stringify(data));
      else sessionStorage.removeItem(storeKey(id));
    } catch { /* modo privado o almacenamiento lleno: no pasa nada */ }
  }, [id]);

  useEffect(() => {
    try { setSoundOn(localStorage.getItem(SOUND_KEY) !== "off"); } catch { /* sin localStorage */ }
    try {
      const raw = sessionStorage.getItem(storeKey(id));
      if (!raw) return;
      const s = JSON.parse(raw) as Stored;
      const t = Date.now();
      if (t - s.endAt > STALE_MS) { sessionStorage.removeItem(storeKey(id)); return; }
      setEndAt(s.endAt); setTotal(s.total); setLabel(s.label); setNow(t);
      if (s.endAt > t) {
        notifiedRef.current = false;
        setPhase("running");
      } else {
        // tras una recarga el audio no está desbloqueado: se muestra sin pitar
        notifiedRef.current = true;
        setPhase("done");
        sessionStorage.setItem(storeKey(id), JSON.stringify({ ...s, notified: true }));
      }
    } catch { /* datos corruptos: se ignoran */ }
  }, [id]);

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on;
      try { localStorage.setItem(SOUND_KEY, next ? "on" : "off"); } catch { /* sin localStorage */ }
      return next;
    });
  }, []);

  // ---------- audio (iOS exige crearlo/desbloquearlo dentro de un toque) ----------
  const unlock = useCallback(() => {
    try {
      if (!audioRef.current) {
        const Ctx = window.AudioContext
          || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        audioRef.current = new Ctx();
      }
      const ctx = audioRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      // un sonido mudo de un instante deja el contexto desbloqueado en iOS
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
    } catch { /* sin Web Audio */ }
  }, []);

  const beep = useCallback(async () => {
    const ctx = audioRef.current;
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") await ctx.resume();
      [0, 0.25].forEach((offset) => {
        const t = ctx.currentTime + offset;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.16);
      });
    } catch { /* sin audio */ }
  }, []);

  // ---------- pantalla encendida (opcional, fallo silencioso) ----------
  const requestWake = useCallback(async () => {
    try {
      const nav = navigator as NavigatorWithWakeLock;
      if (!nav.wakeLock || wakeRef.current || document.visibilityState !== "visible") return;
      wakeRef.current = await nav.wakeLock.request("screen");
    } catch { wakeRef.current = null; }
  }, []);

  const releaseWake = useCallback(() => {
    const w = wakeRef.current;
    wakeRef.current = null;
    if (w) w.release().catch(() => {});
  }, []);

  // ---------- acciones ----------
  const start = useCallback((seconds: number, text = "") => {
    unlock();
    const t = Date.now();
    const end = t + Math.max(0, seconds) * 1000;
    notifiedRef.current = false;
    setNow(t); setEndAt(end); setTotal(seconds); setLabel(text); setPhase("running");
    persist({ endAt: end, total: seconds, label: text, notified: false });
    void requestWake();
  }, [unlock, persist, requestWake]);

  const finish = useCallback((silent = false) => {
    setPhase("done");
    releaseWake();
    if (!notifiedRef.current) {
      notifiedRef.current = true;
      if (!silent && soundOn) {
        void beep();
        try { navigator.vibrate?.([200, 100, 200]); } catch { /* sin vibración */ }
      }
    }
    if (endAt != null) persist({ endAt, total, label, notified: true });
  }, [releaseWake, soundOn, beep, persist, endAt, total, label]);

  const adjust = useCallback((deltaSec: number) => {
    const t = Date.now();
    if (phase === "done") {
      if (deltaSec > 0) start(deltaSec, label);
      return;
    }
    if (phase !== "running" || endAt == null) return;
    const end = Math.max(t, endAt + deltaSec * 1000);
    const newTotal = Math.max(total, Math.ceil((end - t) / 1000));
    setEndAt(end); setTotal(newTotal); setNow(t);
    persist({ endAt: end, total: newTotal, label, notified: false });
    if (end <= t) finish(true);
  }, [phase, endAt, total, label, start, persist, finish]);

  const reset = useCallback((next: RestPhase = "idle") => {
    setPhase(next); setEndAt(null); setLabel("");
    notifiedRef.current = true;
    releaseWake();
    persist(null);
  }, [releaseWake, persist]);

  const skip = useCallback(() => reset("idle"), [reset]);
  const complete = useCallback(() => reset("complete"), [reset]);

  // ---------- reloj de pantalla ----------
  useEffect(() => {
    if (phase !== "running") return;
    const tick = () => setNow(Date.now());
    const iv = setInterval(tick, 250);
    return () => clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (phase === "running" && endAt != null && now >= endAt) finish();
  }, [phase, endAt, now, finish]);

  // al volver a la app: recalcular ya y recuperar el wake lock si sigue en marcha
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") { wakeRef.current = null; return; }
      setNow(Date.now());
      if (phase === "running") void requestWake();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [phase, requestWake]);

  // al salir de la pantalla
  useEffect(() => () => {
    releaseWake();
    const ctx = audioRef.current;
    audioRef.current = null;
    if (ctx) ctx.close().catch(() => {});
  }, [releaseWake]);

  const remainingMs = phase === "running" && endAt != null ? Math.max(0, endAt - now) : 0;

  return {
    phase, label, total, soundOn,
    remaining: Math.ceil(remainingMs / 1000),
    progress: total > 0 ? 1 - remainingMs / (total * 1000) : 0,
    start, adjust, skip, complete, unlock, toggleSound,
  };
}

export type RestTimer = ReturnType<typeof useRestTimer>;
