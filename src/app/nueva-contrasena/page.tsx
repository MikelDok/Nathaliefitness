"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { homePath } from "@/lib/auth";
import PasswordForm from "@/components/PasswordForm";

type Status = "checking" | "ready" | "invalid";

/**
 * Destino del enlace del correo de recuperación.
 * Con el flujo implícito (el que usa supabase-js por defecto) el enlace llega
 * como #access_token=…&type=recovery y el cliente guarda la sesión solo al
 * crearse. Si algún día se pasa a PKCE llegará como ?code=…, y lo canjeamos
 * aquí. Un enlace caducado o ya usado llega con #error_code=… .
 */
export default function NuevaContrasena() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    // Leer la URL antes de crear el cliente, que la procesa y la limpia.
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    const linkError = hash.get("error_code") || hash.get("error")
      || url.searchParams.get("error_code") || url.searchParams.get("error");
    const code = url.searchParams.get("code");

    const sb = getSupabase();
    if (linkError || !sb) { setStatus("invalid"); return; }

    let active = true;
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (active && event === "PASSWORD_RECOVERY" && session) setStatus("ready");
    });

    (async () => {
      // getSession espera a que el cliente termine de leer la sesión de la URL.
      let { data: { session } } = await sb.auth.getSession();
      if (!session && code) {
        const { data } = await sb.auth.exchangeCodeForSession(code);
        session = data.session;
      }
      // Quitar los tokens de la barra de direcciones y del historial.
      if (url.hash || code) window.history.replaceState(null, "", url.pathname);
      if (active) setStatus(session ? "ready" : "invalid");
    })();

    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  async function done() {
    const sb = getSupabase();
    const { data: { user } } = sb ? await sb.auth.getUser() : { data: { user: null } };
    router.replace(sb && user ? await homePath(sb, user.id) : "/login");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="flex justify-center">
        <Image src="/logo.png" alt="NEA FITNESS" width={230} height={230}
          priority className="logo-mark h-auto w-40" />
      </div>
      <p className="eyebrow mt-6 text-center">Nueva contraseña</p>

      {status === "checking" && (
        <p className="mt-6 text-center text-sm text-muted">Comprobando el enlace…</p>
      )}

      {status === "ready" && (
        <div className="mt-6 space-y-3">
          <p className="text-center text-sm text-muted">
            Elige una contraseña nueva para tu cuenta.
          </p>
          <PasswordForm onDone={done} submitLabel="Guardar y entrar" />
        </div>
      )}

      {status === "invalid" && (
        <div className="mt-6 space-y-4 text-center">
          <p className="text-sm">
            Este enlace no es válido o ha caducado.
          </p>
          <p className="text-xs text-muted">
            Los enlaces de recuperación solo sirven una vez y durante un tiempo
            limitado. Pide uno nuevo y ábrelo desde el último correo que recibas.
          </p>
          <Link href="/recuperar"
            className="block w-full rounded-full bg-accent py-3.5 text-sm font-semibold text-accent-ink">
            Pedir un enlace nuevo
          </Link>
          <Link href="/login" className="block w-full py-2 text-xs text-muted">
            Volver a iniciar sesión
          </Link>
        </div>
      )}
    </main>
  );
}
