"use client";

import { useState } from "react";
import PasswordForm from "@/components/PasswordForm";

/** Entrada de Perfil que despliega el formulario de cambio de contraseña. */
export default function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <button
        onClick={() => { setOpen(!open); setSaved(false); }}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm"
      >
        Cambiar contraseña
        <span aria-hidden className={`text-muted transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      </button>
      {saved && !open && (
        <p role="status" className="px-4 pb-3.5 text-xs text-ok">Contraseña actualizada.</p>
      )}
      {open && (
        <div className="px-4 pb-4">
          <PasswordForm onDone={() => { setOpen(false); setSaved(true); }} />
        </div>
      )}
    </div>
  );
}
