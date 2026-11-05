"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Target } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { ICON } from "@/components/ui";
import { requireAuth } from "@/lib/config";

const MAX = 200;
const DEMO_GOAL = "Ganar fuerza en tren inferior y bajar 3 kg antes del verano.";

/** "Datos y objetivos" en Perfil: la clienta ve y edita su objetivo (profiles.goals). */
export default function GoalsEditor() {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<string>(requireAuth ? "" : DEMO_GOAL);
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!requireAuth) return;
    const sb = getSupabase();
    if (!sb) return;
    (async () => {
      const { data: u } = await sb.auth.getUser();
      if (!u.user) return;
      const { data } = await sb.from("profiles").select("goals").eq("id", u.user.id).maybeSingle();
      const g = data?.goals || "";
      setSaved(g); setDraft(g);
    })();
  }, []);

  async function save() {
    setMsg(null);
    const text = draft.trim().slice(0, MAX);
    if (!requireAuth) { setSaved(text); setMsg("Guardado (modo demo, no se guarda)"); return; }
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from("profiles").update({ goals: text || null }).eq("id", u.user!.id);
    setBusy(false);
    if (error) { setMsg("No se pudo guardar. Inténtalo de nuevo."); return; }
    setSaved(text); setDraft(text);
    setMsg("Guardado. Tu entrenadora ya lo ve en tu ficha.");
  }

  return (
    <div>
      <button onClick={() => { setOpen((o) => !o); setMsg(null); }} aria-expanded={open}
        className="flex w-full items-center gap-3 py-3.5 text-left text-sm">
        <Target {...ICON} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1">
          Datos y objetivos
          {!open && (
            <span className="block truncate text-xs text-muted">
              {saved || "Cuéntale a tu entrenadora qué quieres conseguir"}
            </span>
          )}
        </span>
        <ChevronRight {...ICON} className={`shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 pb-4">
          <label className="block text-xs text-muted" htmlFor="goals">Tu objetivo</label>
          <textarea id="goals" value={draft} maxLength={MAX} rows={3}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="P. ej. ganar fuerza, bajar 3 kg, prepararme para una carrera…"
            className="field" />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted">{draft.length}/{MAX}</span>
            <button onClick={save} disabled={busy || draft.trim() === saved}
              className="btn-primary min-h-10 px-5 text-[13px]">
              {busy ? "Guardando…" : "Guardar objetivo"}
            </button>
          </div>
          {msg && <p className="text-xs text-ok">{msg}</p>}
        </div>
      )}
    </div>
  );
}
