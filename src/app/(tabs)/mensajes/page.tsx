"use client";

import { useEffect, useState } from "react";
import Chat from "@/components/Chat";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";

export default function Mensajes() {
  // el hilo de la clienta es ella misma: client_id = su id
  const [uid, setUid] = useState("");
  const [loading, setLoading] = useState(requireAuth);

  useEffect(() => {
    if (!requireAuth) return;
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    sb.auth.getUser().then(({ data }) => {
      setUid(data.user?.id || "");
      setLoading(false);
    });
  }, []);

  return (
    <main className="space-y-4">
      <header>
        <p className="eyebrow">Mensajes</p>
        <h1 className="mt-1 text-2xl font-bold">Nathalie</h1>
      </header>

      {!requireAuth ? (
        <p className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs">
          Modo demo: conecta Supabase para escribirte con tu entrenadora.
        </p>
      ) : loading ? (
        <p className="text-sm text-muted">Cargando conversación…</p>
      ) : uid ? (
        <Chat clientId={uid} />
      ) : (
        <p className="text-sm text-muted">Inicia sesión para ver tus mensajes.</p>
      )}
    </main>
  );
}
