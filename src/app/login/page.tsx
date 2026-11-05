"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail } from "lucide-react";
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
      <div className="mt-10 space-y-3">
        <label className="relative block">
          <Mail size={20} strokeWidth={1.75} aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo electrónico" autoComplete="email" aria-label="Correo electrónico"
            className="field pl-12"
          />
        </label>
        <label className="relative block">
          <Lock size={20} strokeWidth={1.75} aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña" autoComplete="current-password" aria-label="Contraseña"
            className="field pl-12"
          />
        </label>
        {error && <p className="text-xs text-danger">{error}</p>}
        <button
          onClick={submit} disabled={loading}
          className="btn-primary w-full"
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
