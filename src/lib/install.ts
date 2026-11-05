"use client";

// Aviso para instalar la PWA (Inicio y Perfil). El evento nativo de Android
// lo captura INSTALL_SCRIPT (src/lib/installScript.ts) en el <head>.

import { useEffect, useState } from "react";
import { BIP_EVENT, INSTALLED_KEY } from "@/lib/installScript";

export type Platform = "android" | "ios-safari" | "ios-other" | "desktop";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type NeaWindow = Window & { __neaBIP?: InstallPromptEvent | null };

const SNOOZE_KEY = "nea:install-snooze";
const SNOOZE_DAYS = 7;
/** Solo en desarrollo: fuerza la plataforma para probar ("ios-safari", "android-prompt"…). */
const DEBUG_KEY = "nea:install-debug";

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* modo privado */ } };

/** Plataforma a partir del user agent. El iPad moderno dice ser un Mac: se distingue por la pantalla táctil. */
export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1);
  if (ios) {
    // Chrome, Firefox, Edge, Opera, Google, DuckDuckGo o el navegador de una app (Instagram, Facebook)
    return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|DuckDuckGo|Instagram|FBAN|FBAV/i.test(ua) ? "ios-other" : "ios-safari";
  }
  return /Android/i.test(ua) ? "android" : "desktop";
}

function debug(): string | null {
  return process.env.NODE_ENV === "production" ? null : read(DEBUG_KEY);
}

function platformNow(): Platform {
  const d = debug();
  if (d === "android" || d === "android-prompt") return "android";
  if (d === "ios-safari" || d === "ios-other" || d === "desktop") return d;
  return detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
}

/** Abierta como app (desde la pantalla de inicio) o instalada alguna vez en este navegador. */
function installedNow(): boolean {
  if (debug()) return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) write(INSTALLED_KEY, "1");
  return standalone || read(INSTALLED_KEY) === "1";
}

const deferred = () => (window as NeaWindow).__neaBIP ?? null;

export function isSnoozed(): boolean {
  return Number(read(SNOOZE_KEY) || 0) > Date.now();
}

/** "Ahora no": la tarjeta de Inicio se oculta 7 días. */
export function snooze() {
  write(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
}

export type InstallState = {
  /** false hasta montar (en el servidor no se sabe nada) */
  ready: boolean;
  platform: Platform;
  installed: boolean;
  /** Android: el aviso nativo está disponible */
  canPrompt: boolean;
  prompt: () => Promise<void>;
};

export function useInstall(): InstallState {
  const [s, setS] = useState({ ready: false, platform: "desktop" as Platform, installed: true, canPrompt: false });

  useEffect(() => {
    const sync = () => setS({
      ready: true,
      platform: platformNow(),
      installed: installedNow(),
      canPrompt: !!deferred() || debug() === "android-prompt",
    });
    sync();
    window.addEventListener(BIP_EVENT, sync);
    return () => window.removeEventListener(BIP_EVENT, sync);
  }, []);

  async function prompt() {
    const e = deferred();
    if (!e) return;
    (window as NeaWindow).__neaBIP = null; // solo se puede usar una vez
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === "accepted") write(INSTALLED_KEY, "1");
    window.dispatchEvent(new Event(BIP_EVENT));
  }

  return { ...s, prompt };
}
