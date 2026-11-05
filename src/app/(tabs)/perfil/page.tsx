import Link from "next/link";
import {
  Bell, CalendarDays, ChevronRight, ClipboardCheck, HelpCircle, Lightbulb, MessageCircle,
  Palette, Salad, Shield, type LucideIcon,
} from "lucide-react";
import ProfileName from "@/components/ProfileName";
import LogoutButton from "@/components/LogoutButton";
import ChangePassword from "@/components/ChangePassword";
import GoalsEditor from "@/components/GoalsEditor";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { ICON } from "@/components/ui";
import { demo } from "@/lib/demo-data";
import { requireAuth } from "@/lib/config";

// Entradas sin pantalla todavía: se muestran como texto, no como botones.
const soon: { label: string; Icon: LucideIcon }[] = [
  { label: "Preferencias alimentarias", Icon: Salad },
  { label: "Notificaciones", Icon: Bell },
];

/** Fila de la lista de Perfil (las de ChangePassword, GoalsEditor y LogoutButton usan las mismas medidas). */
function RowLink({ href, Icon, children }: { href: string; Icon: LucideIcon; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex w-full items-center gap-3 py-3.5 text-left text-sm">
      <Icon {...ICON} className="shrink-0 text-muted" />
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRight {...ICON} className="shrink-0 text-muted" />
    </Link>
  );
}

export default function Perfil() {
  return (
    <main className="space-y-7">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Perfil</p>
          <h1 className="mt-2 text-[32px]"><ProfileName /></h1>
          <p className="mt-2 text-sm text-muted">{demo.client.coach}</p>
        </div>
        <span aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-raised font-display text-lg font-bold uppercase">
          <ProfileName initial />
        </span>
      </header>

      {!requireAuth && (
        <p className="rounded-xl bg-accent/15 p-3 text-xs">
          Modo demo: conecta Supabase y quita NEXT_PUBLIC_REQUIRE_AUTH=false para
          activar cuentas reales.
        </p>
      )}

      <ul className="divide-y divide-line border-y border-line">
        <li><RowLink href="/agenda" Icon={CalendarDays}>Agenda y citas</RowLink></li>
        <li><RowLink href="/mensajes" Icon={MessageCircle}>Mensajes con tu entrenadora</RowLink></li>
        <li><RowLink href="/checkin" Icon={ClipboardCheck}>Check-in semanal</RowLink></li>
        {requireAuth && <li><ChangePassword /></li>}
        <li><GoalsEditor /></li>
        <li className="flex items-center gap-3 py-3 text-sm">
          <Palette {...ICON} className="shrink-0 text-muted" />
          <span className="flex-1">Tema</span>
          <ThemeSwitcher />
        </li>
        {soon.map(({ label, Icon }) => (
          <li key={label} className="flex items-center gap-3 py-3.5 text-sm text-muted">
            <Icon {...ICON} className="shrink-0" />
            <span className="flex-1">{label}</span>
            <span className="rounded-full bg-surface px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-[0.14em]">
              Próximamente
            </span>
          </li>
        ))}
        <li><RowLink href="/faqs" Icon={HelpCircle}>Preguntas frecuentes</RowLink></li>
        <li><RowLink href="/sugerencias" Icon={Lightbulb}>Sugerencias</RowLink></li>
        <li><RowLink href="/privacidad" Icon={Shield}>Privacidad y mis datos</RowLink></li>
      </ul>

      {requireAuth && (
        <div className="border-y border-line">
          <LogoutButton />
        </div>
      )}
    </main>
  );
}
