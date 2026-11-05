"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Dumbbell, HelpCircle, LayoutDashboard, Lightbulb, ListVideo, LogOut, Salad, type LucideIcon,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { Avatar, ICON } from "@/components/ui";

const nav: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/coach", label: "Resumen", Icon: LayoutDashboard },
  { href: "/coach/programas", label: "Programas", Icon: Dumbbell },
  { href: "/coach/nutricion", label: "Nutrición", Icon: Salad },
  { href: "/coach/ejercicios", label: "Ejercicios", Icon: ListVideo },
  { href: "/coach/sugerencias", label: "Sugerencias", Icon: Lightbulb },
  { href: "/coach/faqs", label: "FAQs", Icon: HelpCircle },
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
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4">
        <Link href="/coach" className="min-w-0">
          <span className="block font-display text-2xl font-bold uppercase leading-none tracking-[0.04em]">
            NEA <span className="text-accent">Fitness</span>
          </span>
          <span className="eyebrow mt-1 block text-[10px]">Panel de la entrenadora</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {name && (
            <span className="hidden max-w-40 truncate text-sm font-medium sm:block">{name}</span>
          )}
          {name && <Avatar name={name} size={36} />}
          <ThemeSwitcher compact />
          <button onClick={signOut} aria-label="Cerrar sesión" title="Cerrar sesión"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-muted">
            <LogOut {...ICON} />
          </button>
        </div>
      </div>
      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-5 pb-3 [scrollbar-width:none]" aria-label="Secciones del panel">
        {nav.map(({ href, label, Icon }) => {
          const active = href === "/coach" ? path === "/coach" : path.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={`chip shrink-0 gap-1.5 ${active ? "chip-active" : ""}`}>
              <Icon size={16} strokeWidth={1.75} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
