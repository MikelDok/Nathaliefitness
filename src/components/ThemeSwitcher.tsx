"use client";

import { useSyncExternalStore } from "react";
import { THEME_OPTIONS, readPref, setPref, subscribePref, type ThemePref } from "@/lib/theme";

/**
 * Selector Oscuro / Claro / Sistema. `compact` (cabecera del panel) muestra
 * símbolos; los nombres completos quedan en aria-label y title.
 * En el servidor se pinta "Oscuro" (por defecto) y se corrige al hidratar.
 */
export default function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const pref = useSyncExternalStore<ThemePref>(subscribePref, readPref, () => "dark");

  return (
    <div role="radiogroup" aria-label="Tema de la app"
      className="inline-flex shrink-0 rounded-full bg-surface p-0.5">
      {THEME_OPTIONS.map((o) => (
        <button key={o.value} onClick={() => setPref(o.value)}
          role="radio" aria-checked={pref === o.value}
          aria-label={compact ? `Tema ${o.label.toLowerCase()}` : undefined}
          title={compact ? o.label : undefined}
          className={`rounded-full font-display font-semibold uppercase tracking-[0.1em] transition-colors ${compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-[11px]"} ${pref === o.value ? "bg-accent text-accent-ink" : "text-muted"}`}>
          {compact ? o.short : o.label}
        </button>
      ))}
    </div>
  );
}
