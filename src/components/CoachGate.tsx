"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";

/** Protege el panel. Sin sesión -> login. Si no es coach -> app de cliente. */
export default function CoachGate({ children }: { children: React.ReactNode }) {
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
      if (p?.role !== "coach") { router.replace("/"); return; }
      setReady(true);
    })();
  }, [router]);

  if (!ready) return null;
  return <>{children}</>;
}
