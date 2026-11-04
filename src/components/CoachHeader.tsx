"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import ThemeSwitcher from "@/components/ThemeSwitcher";

const nav = [
  { href: "/coach", label: "Resumen" },
  { href: "/coach/programas", label: "Programas" },
  { href: "/coach/nutricion", label: "Nutrición" },
  { href: "/coach/ejercicios", label: "Ejercicios" },
  { href: "/coach/sugerencias", label: "Sugerencias" },
  { href: "/coach/faqs", label: "FAQs" },
];

export default function CoachHeader() {
  const router = useRouter();
  const path = usePathname();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!requireAuth) return;
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (!u) return;
      const { data: p } = await sb
        .from("profiles").select("full_name").eq("id", u.id).maybeSingle();
      setName(p?.full_name || u.email?.split("@")[0] || "");
    });
  }, []);

  async function signOut() {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    router.replace("/login");
  }

  return (
    <header className="border-b border-line print:hidden">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div>
          <p className="eyebrow">Panel · NEA FITNESS</p>
          <p className="text-sm font-semibold">{name || "\u00A0"}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher compact />
          <button
            onClick={signOut}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
      <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 pb-2" aria-label="Secciones del panel">
        {nav.map((n) => {
          const active = n.href === "/coach" ? path === "/coach" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                active ? "bg-accent text-accent-ink" : "text-muted"
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
