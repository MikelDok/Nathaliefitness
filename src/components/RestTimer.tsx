"use client";

import type { RestTimer as Timer } from "@/lib/useRestTimer";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

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
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-base">
      <span aria-hidden>{timer.soundOn ? "🔔" : "🔕"}</span>
    </button>
  );

  return (
    <div role="region" aria-label="Temporizador de descanso"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
      {phase === "running" && (
        <div className="h-1 w-full bg-raised" aria-hidden>
          <div className="h-full bg-accent transition-[width] duration-200"
            style={{ width: `${Math.min(100, timer.progress * 100)}%` }} />
        </div>
      )}

      <div className="mx-auto max-w-md px-4 pt-3">
        {phase === "idle" && (
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-sm">
              <span aria-hidden>⏱ </span>Descanso · <span className="figure">{rest} s</span>
            </p>
            {soundBtn}
            <button onClick={() => timer.start(rest)}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
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
            <p className="figure text-center text-5xl leading-none" role="timer" aria-live="off">
              {fmt(timer.remaining)}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={() => timer.adjust(-15)}
                className="rounded-full border border-line py-2.5 text-sm font-medium">
                −15 s
              </button>
              <button onClick={() => timer.adjust(15)}
                className="rounded-full border border-line py-2.5 text-sm font-medium">
                +15 s
              </button>
              <button onClick={timer.skip}
                className="rounded-full bg-accent py-2.5 text-sm font-semibold text-accent-ink">
                Saltar
              </button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="flex items-center gap-3" role="status">
            <p className="min-w-0 flex-1 text-sm font-semibold text-ok">
              ✓ Descanso terminado{nextSet ? ` · ¡a por la serie ${nextSet}!` : ""}
            </p>
            <button onClick={() => timer.adjust(15)}
              className="shrink-0 rounded-full border border-line px-3 py-2 text-xs font-medium">
              +15 s
            </button>
            <button onClick={() => timer.start(rest, timer.label)}
              className="shrink-0 rounded-full border border-line px-3 py-2 text-xs font-medium">
              Repetir
            </button>
            <button onClick={timer.skip} aria-label="Cerrar"
              className="shrink-0 rounded-full border border-line px-3 py-2 text-xs text-muted">
              ✕
            </button>
          </div>
        )}

        {phase === "complete" && (
          <div className="flex items-center gap-3" role="status">
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-semibold text-ok">✓ Series completadas</span>
              <span className="block text-xs text-muted">Guarda el registro y pasa al siguiente ejercicio</span>
            </p>
            <button onClick={() => timer.start(rest)}
              className="shrink-0 rounded-full border border-line px-3 py-2 text-xs font-medium">
              Descansar {rest} s
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
