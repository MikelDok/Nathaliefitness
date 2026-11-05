"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Compass, Download, EllipsisVertical, Share, Smartphone, SquarePlus, type LucideIcon } from "lucide-react";
import { ICON } from "@/components/ui";
import { isSnoozed, snooze, useInstall, type InstallState } from "@/lib/install";

/** Paso numerado con icono (en un círculo raised, que se distingue dentro de una .card). */
function Step({ n, Icon, children }: { n?: number; Icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised text-accent">
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        {n && <span className="sr-only">Paso {n}: </span>}
        {children}
      </span>
    </li>
  );
}

/** Instrucciones según el dispositivo (las mismas en Inicio y en Perfil). */
export function InstallGuide({ install }: { install: InstallState }) {
  const { platform, canPrompt, prompt } = install;

  if (platform === "android") {
    return canPrompt ? (
      <button onClick={() => void prompt()} className="btn-primary w-full">
        <Download size={18} strokeWidth={2} aria-hidden /> Instalar
      </button>
    ) : (
      <ul className="space-y-3">
        <Step Icon={EllipsisVertical}>Abre el menú ⋮ del navegador y toca «Instalar aplicación».</Step>
      </ul>
    );
  }
  if (platform === "ios-safari") {
    return (
      <ol className="space-y-3">
        <Step n={1} Icon={Share}>Toca <b className="font-medium">Compartir</b> en la barra de Safari.</Step>
        <Step n={2} Icon={SquarePlus}>Elige <b className="font-medium">«Añadir a pantalla de inicio»</b>.</Step>
        <Step n={3} Icon={Check}>Toca <b className="font-medium">«Añadir»</b>.</Step>
      </ol>
    );
  }
  if (platform === "ios-other") {
    return (
      <ul className="space-y-3">
        <Step Icon={Compass}>Abre esta página en <b className="font-medium">Safari</b> para instalarla.</Step>
      </ul>
    );
  }
  return <p className="text-sm text-muted">Ábrela desde tu móvil para instalarla.</p>;
}

/** Tarjeta de Inicio: solo en móvil, sin instalar y fuera de los 7 días de "Ahora no". */
export function InstallCard() {
  const install = useInstall();
  const [hidden, setHidden] = useState(true);
  useEffect(() => setHidden(isSnoozed()), []);

  if (!install.ready || install.installed || install.platform === "desktop" || hidden) return null;

  return (
    <section className="card space-y-4" aria-labelledby="install-title">
      <div className="flex items-start gap-3">
        <Smartphone {...ICON} className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0">
          <h2 id="install-title" className="font-display text-xl font-bold uppercase leading-tight tracking-[-0.01em]">
            Instala NEA en tu móvil
          </h2>
          <p className="mt-1 text-sm text-muted">Así la abres desde tu pantalla de inicio, a pantalla completa.</p>
        </div>
      </div>
      <InstallGuide install={install} />
      <button onClick={() => { snooze(); setHidden(true); }}
        className="min-h-11 w-full text-sm text-muted">
        Ahora no
      </button>
    </section>
  );
}

/** Fila de Perfil "Instalar la app": siempre disponible mientras no esté instalada. */
export function InstallRow() {
  const install = useInstall();
  const [open, setOpen] = useState(false);
  if (!install.ready || install.installed) return null;

  return (
    <li>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="install-guide"
        className="flex w-full items-center gap-3 py-3.5 text-left text-sm">
        <Smartphone {...ICON} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1">Instalar la app</span>
        <ChevronDown {...ICON} className={`shrink-0 text-muted transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div id="install-guide" className="pb-4 pl-8"><InstallGuide install={install} /></div>}
    </li>
  );
}
