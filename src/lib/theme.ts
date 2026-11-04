// Tema claro / oscuro. La preferencia vive en localStorage; el tema efectivo
// se aplica como data-theme en <html> y globals.css redefine los tokens.
// El script inline del layout raíz lo aplica antes del primer pintado.

export type ThemePref = "dark" | "light" | "system";
export type Theme = "dark" | "light";

export const THEME_KEY = "nea:theme";
const EVENT = "nea:theme";

/** Color de la barra del navegador (igual que --color-bg de cada tema). */
export const THEME_COLOR: Record<Theme, string> = { dark: "#0f0c0d", light: "#faf7f5" };

export const THEME_OPTIONS: { value: ThemePref; label: string; short: string }[] = [
  { value: "dark", label: "Oscuro", short: "☾" },
  { value: "light", label: "Claro", short: "☀" },
  { value: "system", label: "Sistema", short: "Auto" },
];

const isPref = (v: unknown): v is ThemePref => v === "dark" || v === "light" || v === "system";

export function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isPref(v) ? v : "dark";
  } catch {
    return "dark";
  }
}

export function resolve(pref: ThemePref): Theme {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** Pone data-theme en <html> y actualiza la meta theme-color. */
export function applyTheme(pref: ThemePref = readPref()) {
  const t = resolve(pref);
  document.documentElement.setAttribute("data-theme", t);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", THEME_COLOR[t]));
}

export function setPref(pref: ThemePref) {
  try { localStorage.setItem(THEME_KEY, pref); } catch { /* sin localStorage: solo esta visita */ }
  applyTheme(pref);
  window.dispatchEvent(new Event(EVENT));
}

/** Para useSyncExternalStore: cambios desde esta pestaña o desde otra. */
export function subscribePref(cb: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === THEME_KEY) cb(); };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Script inline (layout raíz): misma lógica que applyTheme, en ES5 y sin
 * dependencias, porque se ejecuta mientras el navegador lee el HTML.
 */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(p!=="light"&&p!=="system")p="dark";var t=p==="system"?(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;document.documentElement.setAttribute("data-theme",t);var c=t==="light"?${JSON.stringify(THEME_COLOR.light)}:${JSON.stringify(THEME_COLOR.dark)};var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute("content",c)}catch(e){}})()`;
