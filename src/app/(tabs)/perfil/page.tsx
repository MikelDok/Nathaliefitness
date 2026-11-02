import Link from "next/link";
import ProfileName from "@/components/ProfileName";
import LogoutButton from "@/components/LogoutButton";
import { demo } from "@/lib/demo-data";
import { requireAuth } from "@/lib/config";

const items = [
  "Datos y objetivos",
  "Check-in semanal",
  "Preferencias alimentarias",
  "Notificaciones",
  "Privacidad y mis datos",
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
        {items.map((label) => (
          <li key={label}>
            <button className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm">
              {label}
              <span aria-hidden className="text-muted">›</span>
            </button>
          </li>
        ))}
        {requireAuth && (
          <li>
            <LogoutButton />
          </li>
        )}
      </ul>
    </main>
  );
}
