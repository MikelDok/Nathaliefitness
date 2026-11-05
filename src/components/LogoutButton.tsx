"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { ICON } from "@/components/ui";
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
      className="flex w-full items-center gap-3 py-3.5 text-left text-sm text-danger"
    >
      <LogOut {...ICON} className="shrink-0" />
      Cerrar sesión
    </button>
  );
}
