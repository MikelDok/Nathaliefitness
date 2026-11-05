"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Apple, Dumbbell, House, TrendingUp, User, type LucideIcon } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { unreadTotal } from "@/lib/chat";
import { pendingTotal } from "@/lib/agenda";

const tabs: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Inicio", Icon: House },
  { href: "/entreno", label: "Entreno", Icon: Dumbbell },
  { href: "/progreso", label: "Progreso", Icon: TrendingUp },
  { href: "/nutricion", label: "Nutrición", Icon: Apple },
  { href: "/perfil", label: "Perfil", Icon: User },
];

export default function BottomNav() {
  const path = usePathname();
  const [unread, setUnread] = useState(0);

  // se recalcula al cambiar de pantalla: al salir del chat el punto ya no está
  useEffect(() => {
    if (!requireAuth) return;
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      const [msgs, appts] = await Promise.all([
        unreadTotal(sb, uid),
        pendingTotal(sb, uid, false),
      ]);
      setUnread(msgs + appts);
    });
  }, [path]);
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={href === "/" && unread > 0
                ? `${label} · ${unread} avisos sin ver` : undefined}
              className={`flex flex-col items-center gap-1 pb-1.5 pt-2.5 font-display text-[10px] font-semibold uppercase tracking-[0.1em] ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <span className="relative">
                <Icon size={22} strokeWidth={1.75} aria-hidden />
                {href === "/" && unread > 0 && (
                  <span aria-hidden
                    className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-accent" />
                )}
              </span>
              {label}
              {/* punto de pestaña activa */}
              <span aria-hidden className={`h-1 w-1 rounded-full ${active ? "bg-accent" : "bg-transparent"}`} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
