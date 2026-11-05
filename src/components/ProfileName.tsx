"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { demo } from "@/lib/demo-data";

/** Devuelve el nombre real del usuario con sesión; en demo, el nombre de ejemplo.
 *  `initial` devuelve solo la inicial (avatar). */
export default function ProfileName({ initial = false }: { initial?: boolean }) {
  const [name, setName] = useState(requireAuth ? "" : demo.client.name);

  useEffect(() => {
    if (!requireAuth) return;
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      const { data: profile } = await sb
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      setName(profile?.full_name || user.email?.split("@")[0] || "");
    });
  }, []);

  return <>{initial ? name.trim().charAt(0) : name}</>;
}
