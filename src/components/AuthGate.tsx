"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";

/** Protege las pestañas de cliente. Sin sesión -> login. Si es coach -> su panel. */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(!requireAuth);

  useEffect(() => {
    if (!requireAuth) return;
    const sb = getSupabase();
    if (!sb) { setReady(true); return; }
    (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) { router.replace("/login"); return; }
      const { data: p } = await sb
        .from("profiles").select("role").eq("id", s.session.user.id).maybeSingle();
      if (p?.role === "coach") { router.replace("/coach"); return; }
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
