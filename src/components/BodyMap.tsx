"use client";

import { useEffect, useRef, useState } from "react";
import Body, { type ExtendedBodyPart, type Slug } from "react-muscle-highlighter";
import { ZONES, type View, type Zone } from "@/lib/muscles";

/*
 * Mapa corporal anatómico: envoltorio de react-muscle-highlighter (modelo
 * femenino). Dibujos: react-native-body-highlighter (MIT) a través de
 * react-muscle-highlighter (MIT); avisos en THIRD_PARTY_NOTICES.md.
 * Cárgalo con BodyMapLazy (next/dynamic) para no pesar en el resto de pantallas.
 */

/** Nuestras zonas → músculos de la librería. */
const ZONE_SLUGS: Record<Zone, Slug[]> = {
  pecho: ["chest"],
  hombros: ["deltoids"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  antebrazos: ["forearm"],
  core: ["abs", "obliques"],
  espalda_alta: ["upper-back", "trapezius"],
  lumbar: ["lower-back"],
  gluteos: ["gluteal"],
  cuadriceps: ["quadriceps"],
  isquios: ["hamstring"],
  gemelos: ["calves"],
};
const SLUG_ZONE = new Map<Slug, Zone>(
  (Object.entries(ZONE_SLUGS) as [Zone, Slug[]][]).flatMap(([z, ss]) => ss.map((s) => [s, z] as [Slug, Zone])),
);
/** Partes que no son músculo de ninguna zona: se pintan como "cuerpo". */
const BODY_SLUGS: Slug[] = ["hair", "head", "neck", "hands", "feet", "knees", "ankles", "tibialis", "adductors"];

type Palette = { body: string; muscle: string; line: string; accent: string; ink: string; hiAlpha: number };

/** Mezcla dos #rrggbb: t = 0 → a, t = 1 → b. */
function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return a;
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((c, i) => Math.round(c + (y[i] - c) * t).toString(16).padStart(2, "0")).join("");
}

/**
 * Colores del tema activo (la librería solo acepta colores, no var()).
 * Oscuro: cuerpo en raised y músculos un gris intermedio entre line y muted
 * (line solo queda casi igual que raised), resaltado al 85 %.
 * Claro: cuerpo en surface, músculos en raised, resaltado al 60 %.
 */
function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  const dark = document.documentElement.dataset.theme !== "light";
  return dark
    ? { body: v("--color-raised"), muscle: mix(v("--color-line"), v("--color-muted"), 0.3), line: v("--color-line"),
        accent: v("--color-accent"), ink: v("--color-ink"), hiAlpha: 0.85 }
    : { body: v("--color-surface"), muscle: v("--color-raised"), line: v("--color-line"),
        accent: v("--color-accent"), ink: v("--color-ink"), hiAlpha: 0.6 };
}

/** Paleta que se repinta al cambiar de tema (data-theme en <html>). */
function usePalette(): Palette | null {
  const [p, setP] = useState<Palette | null>(null);
  useEffect(() => {
    const update = () => setP(readPalette());
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return p;
}

/** #rrggbb + opacidad → #rrggbbaa */
const alpha = (hex: string, a: number) =>
  /^#[0-9a-f]{6}$/i.test(hex) ? hex + Math.round(a * 255).toString(16).padStart(2, "0") : hex;

function Figure({ view, height, highlighted, selected, onSelect, palette }: {
  view: View; height: number; highlighted: Set<Zone>; selected: Zone | null;
  onSelect?: (z: Zone) => void; palette: Palette;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const interactive = !!onSelect;

  const data: ExtendedBodyPart[] = [
    ...BODY_SLUGS.map((slug) => ({ slug, styles: { fill: palette.body } })),
    ...[...SLUG_ZONE].map(([slug, zone]) => ({
      slug,
      styles: {
        fill: zone === selected ? palette.accent : highlighted.has(zone) ? alpha(palette.accent, palette.hiAlpha) : palette.muscle,
        ...(zone === selected ? { stroke: palette.ink, strokeWidth: 2 } : {}),
      },
    })),
  ];

  // Accesibilidad: la librería pinta <svg role="img"> y <path> sin teclado.
  // Tras cada render: un único botón enfocable por zona, con nombre y estado.
  useEffect(() => {
    const root = ref.current;
    const svg = root?.querySelector("svg");
    if (!root || !svg) return;
    const name = `Mapa corporal, vista ${view === "front" ? "delantera" : "trasera"}`;
    if (!interactive) {
      svg.setAttribute("aria-hidden", "true");
      svg.removeAttribute("role");
      return;
    }
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", name);
    const seen = new Set<Zone>();
    root.querySelectorAll<SVGPathElement>("path[id]").forEach((p) => {
      const zone = SLUG_ZONE.get(p.id as Slug);
      if (zone && !seen.has(zone)) {
        seen.add(zone);
        p.setAttribute("role", "button");
        p.setAttribute("tabindex", "0");
        p.setAttribute("aria-label", ZONES[zone].label);
        p.setAttribute("aria-pressed", String(zone === selected));
        p.dataset.zone = zone;
      } else {
        p.removeAttribute("tabindex");
        p.setAttribute("aria-hidden", "true");
        if (!zone) p.style.cursor = "default";
      }
    });
  });

  return (
    <div ref={ref} className="bodymap"
      onKeyDown={(e) => {
        const zone = (e.target as SVGElement).dataset?.zone as Zone | undefined;
        if (zone && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect?.(zone); }
      }}
      style={interactive ? undefined : { pointerEvents: "none" }}>
      <Body data={data} side={view} gender="female" scale={height / 400}
        border={palette.line} defaultFill={palette.muscle}
        onBodyPartPress={(part) => { const z = part.slug && SLUG_ZONE.get(part.slug); if (z) onSelect?.(z); }} />
    </div>
  );
}

/**
 * Mapa corporal. `highlighted` resalta zonas (accent suave); `selected`, una
 * zona en accent sólido. Con `onSelect`, las zonas son botones accesibles; sin
 * él, el dibujo es decorativo (aria-hidden) y la información va en texto.
 */
export default function BodyMap({ highlighted = [], selected = null, onSelect, view = "both", size = 220, labels = false }: {
  highlighted?: Zone[];
  selected?: Zone | null;
  onSelect?: (z: Zone) => void;
  view?: View | "both";
  /** alto de cada figura en px */
  size?: number;
  /** "Delante" / "Detrás" bajo cada figura */
  labels?: boolean;
}) {
  const palette = usePalette();
  const views: View[] = view === "both" ? ["front", "back"] : [view];
  const set = new Set(highlighted);
  return (
    <div className="flex shrink-0 items-start justify-center gap-2">
      {views.map((v) => (
        <div key={v} className="flex flex-col items-center" style={{ width: size / 2, minHeight: size }}>
          {palette && (
            <Figure view={v} height={size} highlighted={set} selected={selected}
              onSelect={onSelect} palette={palette} />
          )}
          {labels && <p className="eyebrow mt-2">{v === "front" ? "Delante" : "Detrás"}</p>}
        </div>
      ))}
    </div>
  );
}
