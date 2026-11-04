"use client";

import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export default function LogoutButton() {
  const router = useRouter();
  async function signOut() {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    router.replace("/login");
  }
  return (
    <button
      onClick={signOut}
      className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm text-danger"
    >
      Cerrar sesión
      <span aria-hidden className="text-muted">›</span>
    </button>
  );
}
