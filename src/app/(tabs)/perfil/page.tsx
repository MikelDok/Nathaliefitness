import Link from "next/link";
import ProfileName from "@/components/ProfileName";
import LogoutButton from "@/components/LogoutButton";
import ChangePassword from "@/components/ChangePassword";
import GoalsEditor from "@/components/GoalsEditor";
import { demo } from "@/lib/demo-data";
import { requireAuth } from "@/lib/config";

// Entradas sin pantalla todavía: se muestran como texto, no como botones.
const soon = [
  "Preferencias alimentarias",
  "Notificaciones",
];

export default function Perfil() {
  return (
    <main className="space-y-5">
      <header>
        <p className="eyebrow">Perfil</p>
        <h1 className="mt-1 text-2xl font-bold"><ProfileName /></h1>
        <p className="text-sm text-muted">{demo.client.coach}</p>
      </header>

      {!requireAuth && (
        <p className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs">
          Modo demo: conecta Supabase y quita NEXT_PUBLIC_REQUIRE_AUTH=false para
          activar cuentas reales.
        </p>
      )}

      {requireAuth && (
        <p className="rounded-xl bg-raised p-3 text-xs text-muted">
          Sesión real activa. El contenido de las pantallas es de ejemplo hasta
          que se conecten los datos en la Fase 2.
        </p>
      )}

      <ul className="card divide-y divide-line">
        <li>
          <Link href="/agenda"
            className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm">
            Agenda y citas
            <span aria-hidden className="text-muted">›</span>
          </Link>
        </li>
        <li>
          <Link href="/mensajes"
            className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm">
            Mensajes con tu entrenadora
            <span aria-hidden className="text-muted">›</span>
          </Link>
        </li>
        <li>
          <Link href="/checkin"
            className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm">
            Check-in semanal
            <span aria-hidden className="text-muted">›</span>
          </Link>
        </li>
        {requireAuth && (
          <li>
            <ChangePassword />
          </li>
        )}
        <li>
          <GoalsEditor />
        </li>
        {soon.map((label) => (
          <li key={label}
            className="flex items-center justify-between px-4 py-3.5 text-sm text-muted">
            {label}
            <span className="rounded-full bg-raised px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              Próximamente
            </span>
          </li>
        ))}
        <li>
          <Link href="/privacidad"
            className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm">
            Privacidad y mis datos
            <span aria-hidden className="text-muted">›</span>
          </Link>
        </li>
        {requireAuth && (
          <li>
            <LogoutButton />
          </li>
        )}
      </ul>
    </main>
  );
}
