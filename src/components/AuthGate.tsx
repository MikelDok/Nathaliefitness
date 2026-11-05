"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { DEMO_WELCOME_KEY } from "@/lib/welcome";

/**
 * Protege las pestañas de cliente. Sin sesión -> login. Si es coach -> su
 * panel. Si es clienta y aún no ha visto la bienvenida -> /bienvenida.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!requireAuth) {
      // demo: la bienvenida, una vez por sesión del navegador
      let seen = true;
      try { seen = sessionStorage.getItem(DEMO_WELCOME_KEY) === "1"; } catch { /* nada */ }
      if (!seen) { router.replace("/bienvenida"); return; }
      setReady(true);
      return;
    }
    const sb = getSupabase();
    if (!sb) { setReady(true); return; }
    (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) { router.replace("/login"); return; }
      const { data: p, error } = await sb
        .from("profiles").select("role,onboarded_at").eq("id", s.session.user.id).maybeSingle();
      if (error) {
        // p. ej. la 0016 aún no aplicada: sin bienvenida, pero sin bloquear la app
        const { data: r } = await sb
          .from("profiles").select("role").eq("id", s.session.user.id).maybeSingle();
        if (r?.role === "coach") { router.replace("/coach"); return; }
        setReady(true);
        return;
      }
      if (p?.role === "coach") { router.replace("/coach"); return; }
      if (p && !p.onboarded_at) { router.replace("/bienvenida"); return; }
      setReady(true);
    })();
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (!ready) return null;
  return <>{children}</>;
}
