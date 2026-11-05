"use client";

import BodyMap from "@/components/BodyMapLazy";
import { workSummary, zonesOfGroups } from "@/lib/muscles";

/**
 * "Hoy trabajas": silueta compacta delante+detrás con los grupos de una
 * sesión resaltados y la frase en texto (la silueta es decorativa; la
 * información para lectores de pantalla es la frase). Si la sesión no tiene
 * grupos con zona ni palabra (solo cardio/movilidad o vacía), no pinta nada.
 */
export default function MuscleDay({ groups, label = "Hoy trabajas", size = 140 }: {
  groups: (string | null | undefined)[];
  label?: string;
  size?: number;
}) {
  const zones = zonesOfGroups(groups);
  const summary = workSummary(groups);
  if (zones.length === 0 && !summary) return null;
  return (
    <section className="flex items-center gap-4" aria-label={label}>
      <BodyMap view="both" size={size} highlighted={zones} />
      <div className="min-w-0">
        <p className="eyebrow">{label}</p>
        <p className="mt-1 font-display text-2xl font-bold uppercase leading-tight tracking-[-0.01em]">
          {summary ?? "Cardio y movilidad"}
        </p>
      </div>
    </section>
  );
}
