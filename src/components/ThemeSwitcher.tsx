"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_OPTIONS, readPref, setPref, subscribePref, type ThemePref } from "@/lib/theme";

/**
 * Selector Oscuro / Claro / Sistema. `compact` (cabecera del panel) muestra
 * iconos lucide; los nombres completos quedan en aria-label y title.
 * En el servidor se pinta "Oscuro" (por defecto) y se corrige al hidratar.
 */
const COMPACT_ICON = { dark: Moon, light: Sun, system: Monitor } as const;

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
          className={`rounded-full font-display font-semibold uppercase tracking-[0.1em] transition-colors ${compact ? "flex h-8 w-8 items-center justify-center" : "px-3 py-1.5 text-[11px]"} ${pref === o.value ? "bg-accent text-accent-ink" : "text-muted"}`}>
          {compact
            ? (() => { const Icon = COMPACT_ICON[o.value]; return <Icon size={16} strokeWidth={1.75} aria-hidden />; })()
            : o.label}
        </button>
      ))}
    </div>
  );
}
