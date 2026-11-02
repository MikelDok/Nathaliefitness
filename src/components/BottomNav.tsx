"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { unreadTotal } from "@/lib/chat";
import { pendingTotal } from "@/lib/agenda";

const tabs = [
  { href: "/", label: "Inicio", icon: "M3 11.5 12 4l9 7.5M5.5 9.8V20h13V9.8" },
  { href: "/entreno", label: "Entreno", icon: "M2 12h3m14 0h3M6.5 8v8M17.5 8v8M9 6.5v11M15 6.5v11" },
  { href: "/progreso", label: "Progreso", icon: "M4 19V5m0 14h16M7 15l4-5 3 3 5-7" },
  { href: "/nutricion", label: "Nutrición", icon: "M12 3c-4 2-6 5-6 9a6 6 0 0 0 12 0c0-4-2-7-6-9Zm0 0v6" },
  { href: "/perfil", label: "Perfil", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" },
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
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              aria-label={t.href === "/" && unread > 0
                ? `${t.label} · ${unread} avisos sin ver` : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <span className="relative">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d={t.icon} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t.href === "/" && unread > 0 && (
                  <span aria-hidden
                    className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-accent" />
                )}
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
