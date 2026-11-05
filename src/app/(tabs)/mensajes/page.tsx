"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import Chat from "@/components/Chat";
import { EmptyState, PageHeader } from "@/components/ui";
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
    <main className="space-y-7">
      <PageHeader eyebrow="Mensajes" title="Nathalie" />

      {!requireAuth ? (
        <EmptyState icon={MessageCircle}>
          Modo demo: conecta Supabase para escribirte con tu entrenadora.
        </EmptyState>
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
