"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Confirmación por doble toque (sin diálogos del navegador): el primer toque
 * "arma" el elemento y el segundo lo confirma. Si no hay segundo toque en
 * `ms`, se desarma solo. Uso: `if (!del.confirm(id)) return;` al principio
 * del borrado, y `del.pending === id` para pintar el botón armado.
 */
export function useConfirm(ms = 3000) {
  const [pending, setPending] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  /** true si es el segundo toque sobre el mismo elemento (borrado confirmado). */
  function confirm(id: string): boolean {
    clearTimeout(timer.current);
    if (pending === id) { setPending(null); return true; }
    setPending(id);
    timer.current = setTimeout(() => setPending(null), ms);
    return false;
  }

  return { pending, confirm };
}
