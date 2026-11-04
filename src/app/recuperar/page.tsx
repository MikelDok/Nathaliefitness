"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

export default function Recuperar() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) { setError("La recuperación no está disponible en el modo demo."); return; }
    setLoading(true); setError(null);
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    });
    setLoading(false);
    // Solo el límite de envíos merece un aviso propio: no dice nada sobre si el
    // correo existe. Cualquier otro resultado muestra el mismo mensaje neutro.
    if (error && (error.status === 429 || error.code?.startsWith("over_"))) {
      setError("Has pedido varios enlaces seguidos. Espera unos minutos y vuelve a probar.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="flex justify-center">
        <Image src="/logo.png" alt="NEA FITNESS" width={230} height={230}
          priority className="h-auto w-40" />
      </div>
      <p className="eyebrow mt-6 text-center">Recuperar contraseña</p>

      {sent ? (
        <div className="mt-6 space-y-3 text-center">
          <p className="text-sm">
            Si el correo existe, recibirás un enlace para crear una contraseña nueva.
          </p>
          <p className="text-xs text-muted">
            Revisa también la carpeta de spam. El enlace caduca al cabo de un rato.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-3">
          <p className="text-center text-sm text-muted">
            Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.
          </p>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo electrónico" autoComplete="email" required
            className="w-full rounded-xl border border-line bg-surface px-4 py-3.5 text-sm"
          />
          {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full rounded-full bg-accent py-3.5 font-semibold text-accent-ink disabled:opacity-60"
          >
            {loading ? "Enviando…" : "Enviar enlace"}
          </button>
        </form>
      )}

      <Link href="/login" className="mt-4 block w-full py-2 text-center text-xs text-muted">
        Volver a iniciar sesión
      </Link>
    </main>
  );
}
