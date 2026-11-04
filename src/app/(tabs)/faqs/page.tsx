"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { demo } from "@/lib/demo-data";

type Faq = { id: string; question: string; answer: string };

export default function Faqs() {
  const [faqs, setFaqs] = useState<Faq[]>(requireAuth ? [] : demo.faqs);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(requireAuth);

  useEffect(() => {
    if (!requireAuth) return;
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    (async () => {
      // la RLS ya limita a las publicadas de su entrenadora
      const { data } = await sb.from("faqs").select("id,question,answer")
        .eq("published", true).order("position").order("created_at");
      setFaqs((data as Faq[]) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="space-y-5">
      <header>
        <Link href="/perfil" className="text-xs text-muted">‹ Perfil</Link>
        <h1 className="mt-1 text-2xl font-bold">Preguntas frecuentes</h1>
      </header>

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : faqs.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-3xl" aria-hidden>❓</p>
          <p className="mt-2 text-sm text-muted">Tu entrenadora aún no ha publicado preguntas.</p>
        </div>
      ) : (
        <ul className="card divide-y divide-line">
          {faqs.map((f) => {
            const isOpen = open === f.id;
            return (
              <li key={f.id}>
                <button onClick={() => setOpen(isOpen ? null : f.id)} aria-expanded={isOpen}
                  aria-controls={`faq-${f.id}`}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium">
                  {f.question}
                  <span aria-hidden className="shrink-0 text-muted">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <p id={`faq-${f.id}`} className="whitespace-pre-line px-4 pb-4 text-sm text-muted">
                    {f.answer}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
