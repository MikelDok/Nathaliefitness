"use client";

import { use, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";
import Chat from "@/components/Chat";
import { getSupabase } from "@/lib/supabase";

export default function ChatClienta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [name, setName] = useState("");

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.from("profiles").select("full_name").eq("id", id).maybeSingle()
      .then(({ data }) => setName((data as { full_name: string } | null)?.full_name || ""));
  }, [id]);

  return (
    <main className="mx-auto max-w-2xl space-y-7">
      <PageHeader back={`/coach/clientes/${id}`} eyebrow="Mensajes" title={name || "Clienta"} />

      <Chat clientId={id} />
    </main>
  );
}
