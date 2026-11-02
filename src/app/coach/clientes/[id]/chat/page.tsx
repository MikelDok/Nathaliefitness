"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
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
    <main className="space-y-4">
      <header className="flex items-center gap-3">
        <Link href={`/coach/clientes/${id}`} aria-label="Volver a la ficha"
          className="rounded-full border border-line p-2 text-muted">←</Link>
        <div>
          <p className="eyebrow">Mensajes</p>
          <h1 className="text-xl font-bold">{name || "Clienta"}</h1>
        </div>
      </header>

      <Chat clientId={id} />
    </main>
  );
}
