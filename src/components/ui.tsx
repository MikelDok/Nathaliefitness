import Link from "next/link";
import { Check, ChevronLeft, type LucideIcon } from "lucide-react";

/** Props comunes de los iconos lucide de la interfaz: 20 px, trazo 1,75, decorativos. */
export const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;

/** Clase de chip (pestañas de semana/día, filtros). */
export const chip = (active: boolean) => `chip shrink-0 ${active ? "chip-active" : ""}`;

/** Cabecera de pantalla: eyebrow + h1, con botón de volver y acción a la derecha opcionales. */
export function PageHeader({ eyebrow, title, back, right, children }: {
  eyebrow?: string;
  title: React.ReactNode;
  /** ruta a la que vuelve la flecha */
  back?: string;
  right?: React.ReactNode;
  /** línea secundaria bajo el título */
  children?: React.ReactNode;
}) {
  return (
    <header className="flex items-start gap-3">
      {back && (
        <Link href={back} aria-label="Volver"
          className="-ml-1 mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-muted">
          <ChevronLeft {...ICON} />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className={`${eyebrow ? "mt-2" : ""} text-[32px]`}>{title}</h1>
        {children && <div className="mt-2 text-sm text-muted">{children}</div>}
      </div>
      {right}
    </header>
  );
}

/** Estado vacío: icono grande en muted + una línea, sin caja. */
export function EmptyState({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted">
      <Icon size={32} strokeWidth={1.5} aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** Check redondo: relleno en accent si está hecho, contorno si no. */
export function CheckDot({ on, size = 22 }: { on: boolean; size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-full ${on ? "bg-accent text-accent-ink" : "border-[1.5px] border-muted/60"}`}>
      {on && <Check size={Math.round(size * 0.62)} strokeWidth={3} />}
    </span>
  );
}
