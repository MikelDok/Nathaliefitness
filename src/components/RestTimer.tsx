"use client";

import { Bell, BellOff, Check, Timer as TimerIcon, X } from "lucide-react";
import type { RestTimer as Timer } from "@/lib/useRestTimer";
import { ICON } from "@/components/ui";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Chip de acción del temporizador (sin borde, fondo raised). */
const action = "chip min-h-10 justify-center bg-raised text-ink";

/** Barra fija inferior con el descanso entre series. */
export default function RestTimer({ timer, rest, nextSet }: {
  timer: Timer;
  /** descanso del ejercicio en segundos (ya con el 90 por defecto aplicado) */
  rest: number;
  /** número de la próxima serie sin marcar, o null si están todas */
  nextSet: number | null;
}) {
  const { phase } = timer;

  const soundBtn = (
    <button onClick={timer.toggleSound} aria-pressed={timer.soundOn}
      aria-label={timer.soundOn ? "Sonido y vibración activados" : "Sonido y vibración desactivados"}
      title={timer.soundOn ? "Silenciar aviso" : "Activar aviso"}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-raised text-muted">
      {timer.soundOn ? <Bell {...ICON} /> : <BellOff {...ICON} />}
    </button>
  );

  return (
    <div role="region" aria-label="Temporizador de descanso"
      className="fixed inset-x-0 bottom-0 z-20 bg-surface"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
      {/* progreso fino arriba (sustituye al borde superior) */}
      <div className="h-0.5 w-full bg-line" aria-hidden>
        {phase === "running" && (
          <div className="h-full bg-accent transition-[width] duration-200"
            style={{ width: `${Math.min(100, timer.progress * 100)}%` }} />
        )}
      </div>

      <div className="mx-auto max-w-md px-5 pt-3">
        {phase === "idle" && (
          <div className="flex items-center gap-3">
            <TimerIcon {...ICON} className="shrink-0 text-muted" />
            <p className="min-w-0 flex-1 text-sm">
              <span className="eyebrow mr-2">Descanso</span><span className="figure text-xl">{rest} s</span>
            </p>
            {soundBtn}
            <button onClick={() => timer.start(rest)} className="btn-primary min-h-10 px-5">
              Iniciar
            </button>
          </div>
        )}

        {phase === "running" && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow truncate">Descanso{timer.label ? ` · ${timer.label}` : ""}</p>
              {soundBtn}
            </div>
            <p className="figure text-center text-[56px]" role="timer" aria-live="off">
              {fmt(timer.remaining)}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={() => timer.adjust(-15)} className={action}>−15 s</button>
              <button onClick={() => timer.adjust(15)} className={action}>+15 s</button>
              <button onClick={timer.skip} className="chip chip-active min-h-10 justify-center">Saltar</button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="flex items-center gap-2" role="status">
            <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-ok">
              <Check size={18} strokeWidth={2.5} aria-hidden className="shrink-0" />
              <span>Descanso terminado{nextSet ? ` · ¡a por la serie ${nextSet}!` : ""}</span>
            </p>
            <button onClick={() => timer.adjust(15)} className={`${action} px-3`}>+15 s</button>
            <button onClick={() => timer.start(rest, timer.label)} className={`${action} px-3`}>Repetir</button>
            <button onClick={timer.skip} aria-label="Cerrar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-raised text-muted">
              <X {...ICON} />
            </button>
          </div>
        )}

        {phase === "complete" && (
          <div className="flex items-center gap-3" role="status">
            <Check size={20} strokeWidth={2.5} aria-hidden className="shrink-0 text-ok" />
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-medium text-ok">Series completadas</span>
              <span className="block text-xs text-muted">Guarda el registro y pasa al siguiente ejercicio</span>
            </p>
            <button onClick={() => timer.start(rest)} className={`${action} shrink-0 px-3`}>
              Descansar {rest} s
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
