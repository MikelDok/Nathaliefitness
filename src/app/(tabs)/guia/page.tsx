"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, ListVideo, Video, VideoOff, X } from "lucide-react";
import BodyMap from "@/components/BodyMapLazy";
import { EmptyState, ICON, PageHeader, chip } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { demoLibrary } from "@/lib/demo-data";
import {
  ZONES, ZONELESS_GROUPS, normalize, zonesOf, type View, type Zone,
} from "@/lib/muscles";

type Exercise = { id: string; name: string; muscle_group: string; video_url: string | null };
type Pick = { kind: "zone"; zone: Zone } | { kind: "group"; group: string };

/** Guía de ejercicios: mapa corporal → ejercicios de la biblioteca de su entrenadora. */
export default function Guia() {
  const [list, setList] = useState<Exercise[]>(requireAuth ? [] : demoLibrary());
  const [loading, setLoading] = useState(requireAuth);
  const [view, setView] = useState<View>("front");
  const [pick, setPick] = useState<Pick | null>(null);
  const [open, setOpen] = useState<Exercise | null>(null);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!requireAuth) return;
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    (async () => {
      // la RLS ya limita a la biblioteca de su entrenadora
      const { data } = await sb.from("exercises").select("id,name,muscle_group,video_url").order("name");
      setList((data as Exercise[]) || []);
      setLoading(false);
    })();
  }, []);

  const inZone = (z: Zone) => list.filter((e) => zonesOf(e.muscle_group).includes(z));
  const shown = !pick ? [] : pick.kind === "zone"
    ? inZone(pick.zone)
    : list.filter((e) => normalize(e.muscle_group) === normalize(pick.group));
  const title = !pick ? "" : pick.kind === "zone" ? ZONES[pick.zone].label : pick.group;

  function choose(p: Pick) {
    setPick(p);
    // en móvil la lista queda bajo la silueta: la acercamos
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  return (
    <main className="space-y-7">
      <PageHeader back="/entreno" eyebrow="Entrenamiento" title="Guía de ejercicios">
        Toca un músculo para ver los ejercicios de tu entrenadora.
      </PageHeader>

      <div className="flex gap-1" role="radiogroup" aria-label="Vista del cuerpo">
        {(["front", "back"] as View[]).map((v) => (
          <button key={v} onClick={() => setView(v)} role="radio" aria-checked={view === v} className={chip(view === v)}>
            {v === "front" ? "Delante" : "Detrás"}
          </button>
        ))}
      </div>

      <div className="flex justify-center">
        {/* solo la zona elegida en color: con más zonas resaltadas no se distinguiría */}
        <BodyMap view={view} size={380}
          selected={pick?.kind === "zone" ? pick.zone : null}
          onSelect={(zone) => choose({ kind: "zone", zone })} />
      </div>

      <div>
        <p className="eyebrow">Sin zona en el mapa</p>
        <div className="mt-2 flex gap-1">
          {ZONELESS_GROUPS.map((g) => (
            <button key={g} onClick={() => choose({ kind: "group", group: g })}
              aria-pressed={pick?.kind === "group" && pick.group === g}
              className={`${chip(pick?.kind === "group" && pick.group === g)} ${pick?.kind === "group" && pick.group === g ? "" : "bg-surface"}`}>
              {g}
            </button>
          ))}
        </div>
      </div>

      <section ref={resultsRef} aria-live="polite" className="scroll-mt-6">
        {loading ? (
          <p className="text-sm text-muted">Cargando la biblioteca…</p>
        ) : !pick ? (
          <p className="text-sm text-muted">
            Elige una zona del cuerpo o un grupo para ver sus ejercicios.
          </p>
        ) : (
          <>
            <p className="eyebrow border-b border-line pb-2">{title} · {shown.length} ejercicio{shown.length === 1 ? "" : "s"}</p>
            {shown.length === 0 ? (
              <EmptyState icon={ListVideo}>Tu entrenadora aún no tiene ejercicios de este grupo.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {shown.map((e) => (
                  <li key={e.id}>
                    <button onClick={() => setOpen(e)} className="flex w-full items-center gap-3 py-3.5 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.name}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                          {e.video_url
                            ? <><Video size={14} strokeWidth={1.75} aria-hidden /> Con vídeo</>
                            : <><VideoOff size={14} strokeWidth={1.75} aria-hidden /> Sin vídeo</>}
                          {pick.kind === "zone" && ` · ${e.muscle_group}`}
                        </span>
                      </span>
                      <ChevronRight {...ICON} className="shrink-0 text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {open && <VideoSheet exercise={open} onClose={() => setOpen(null)} />}
    </main>
  );
}

/** Hoja inferior con el vídeo (solo consulta: no se registra nada). */
function VideoSheet({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus(); };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="sheet-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-[20px] bg-bg px-5 pb-8 pt-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{exercise.muscle_group}</p>
            <h2 id="sheet-title" className="mt-1 font-display text-2xl font-bold uppercase leading-tight">{exercise.name}</h2>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Cerrar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-muted">
            <X {...ICON} />
          </button>
        </div>
        <div className="mt-4 overflow-hidden rounded-[14px] bg-surface">
          {exercise.video_url ? (
            <iframe title={`Vídeo: ${exercise.name}`} src={exercise.video_url} className="aspect-video w-full"
              allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 text-sm text-muted">
              <VideoOff size={32} strokeWidth={1.5} aria-hidden />
              Este ejercicio aún no tiene vídeo
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          Solo para consultar la técnica: no forma parte de tu programa ni se registra.
        </p>
      </div>
    </div>
  );
}
