"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { homePath } from "@/lib/auth";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const sb = getSupabase();
    if (!sb) { router.replace("/"); return; } // modo demo: entra directo
    setLoading(true); setError(null);
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setLoading(false);
      setError("Correo o contraseña incorrectos. Revisa e inténtalo de nuevo.");
      return;
    }
    const home = await homePath(sb, data.user.id);
    setLoading(false);
    router.replace(home);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="flex justify-center">
        <Image
          src="/logo.png"
          alt="NEA FITNESS"
          width={230}
          height={230}
          priority
          className="logo-mark h-auto w-56"
        />
      </div>
      <p className="eyebrow mt-6 text-center tracking-[0.22em]">
        Entrena · Avanza · Disfruta
      </p>
      <div className="mt-8 space-y-3">
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo electrónico" autoComplete="email"
          className="w-full rounded-xl border border-line bg-surface px-4 py-3.5 text-sm"
        />
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña" autoComplete="current-password"
          className="w-full rounded-xl border border-line bg-surface px-4 py-3.5 text-sm"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <button
          onClick={submit} disabled={loading}
          className="w-full rounded-full bg-accent py-3.5 font-semibold text-accent-ink disabled:opacity-60"
        >
          {loading ? "Entrando…" : "Iniciar sesión"}
        </button>
        <Link href="/recuperar" className="block w-full py-2 text-center text-xs text-muted">
          He olvidado mi contraseña
        </Link>
        <Link href="/privacidad" className="block w-full text-center text-[11px] text-muted/70">
          Privacidad
        </Link>
      </div>
    </main>
  );
}
