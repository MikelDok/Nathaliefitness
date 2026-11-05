"use client";

import { useState } from "react";
import { ChevronRight, Lock } from "lucide-react";
import PasswordForm from "@/components/PasswordForm";
import { ICON } from "@/components/ui";

/** Entrada de Perfil que despliega el formulario de cambio de contraseña. */
export default function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <button
        onClick={() => { setOpen(!open); setSaved(false); }}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-3.5 text-left text-sm"
      >
        <Lock {...ICON} className="shrink-0 text-muted" />
        <span className="flex-1">Cambiar contraseña</span>
        <ChevronRight {...ICON} className={`shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {saved && !open && (
        <p role="status" className="pb-3.5 pl-8 text-xs text-ok">Contraseña actualizada.</p>
      )}
      {open && (
        <div className="pb-4">
          <PasswordForm onDone={() => { setOpen(false); setSaved(true); }} />
        </div>
      )}
    </div>
  );
}
