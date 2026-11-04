"use client";

import { useLayoutEffect } from "react";
import { applyTheme, readPref, subscribePref } from "@/lib/theme";

/**
 * Mantiene data-theme al día después de la hidratación:
 *  - lo reaplica al montar (en desarrollo, el Strict Mode borra los
 *    atributos de <html> que puso el script inline);
 *  - con "Sistema", sigue los cambios de modo claro/oscuro del móvil;
 *  - aplica cambios hechos en otra pestaña.
 */
export default function ThemeSync() {
  useLayoutEffect(() => {
    applyTheme();
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onSystem = () => { if (readPref() === "system") applyTheme("system"); };
    mq.addEventListener("change", onSystem);
    const unsub = subscribePref(() => applyTheme());
    return () => { mq.removeEventListener("change", onSystem); unsub(); };
  }, []);
  return null;
}
