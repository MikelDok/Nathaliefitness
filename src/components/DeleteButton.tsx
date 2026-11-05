"use client";

import { Trash2 } from "lucide-react";
import { ICON } from "@/components/ui";

/**
 * Botón de borrar con doble toque (junto a `useConfirm`): en reposo es un
 * icono de papelera; armado, pide "¿Borrar? Toca otra vez".
 */
export default function DeleteButton({ armed, onClick, label, disabled }: {
  armed: boolean;
  onClick: () => void;
  /** qué se borra, para lectores de pantalla: "Borrar Prensa" */
  label: string;
  disabled?: boolean;
}) {
  return armed ? (
    <button onClick={onClick} disabled={disabled} aria-label={`Confirmar: ${label}`}
      className="chip min-h-9 shrink-0 bg-danger/15 px-3 text-danger disabled:opacity-60">
      ¿Borrar? Toca otra vez
    </button>
  ) : (
    <button onClick={onClick} disabled={disabled} aria-label={label} title="Borrar"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-danger disabled:opacity-60">
      <Trash2 {...ICON} />
    </button>
  );
}
