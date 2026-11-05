"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { MIN_PASSWORD } from "@/lib/auth";

/** Traduce los errores de updateUser a un mensaje que la usuaria pueda entender. */
function message(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "same_password":
      return "La nueva contraseña tiene que ser distinta de la anterior.";
    case "weak_password":
      return "Esa contraseña es demasiado débil. Prueba con una más larga o con números y símbolos.";
    case "session_not_found":
    case "session_expired":
    case "reauthentication_needed":
      return "Tu sesión ha caducado. Vuelve a entrar y repite el cambio.";
    case "over_request_rate_limit":
      return "Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.";
    default:
      return "No se ha podido guardar la contraseña. Inténtalo de nuevo.";
  }
}

/** Nueva contraseña + repetir. Llama a onDone cuando Supabase la ha guardado. */
export default function PasswordForm({
  onDone, submitLabel = "Guardar contraseña",
}: { onDone: () => void | Promise<void>; submitLabel?: string }) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== repeat) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    const sb = getSupabase();
    if (!sb) { setError("No hay conexión con el servidor."); return; }
    setLoading(true); setError(null);
    const { error } = await sb.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setError(message(error));
      return;
    }
    setPassword(""); setRepeat("");
    await onDone();
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="password" value={password} onChange={(e) => setPassword(e.target.value)}
        placeholder={`Nueva contraseña (mín. ${MIN_PASSWORD} caracteres)`}
        autoComplete="new-password" minLength={MIN_PASSWORD} required
        className="field"
      />
      <input
        type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)}
        placeholder="Repite la nueva contraseña"
        autoComplete="new-password" required
        className="field"
      />
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <button
        type="submit" disabled={loading}
        className="btn-primary w-full"
      >
        {loading ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
