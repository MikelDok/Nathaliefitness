"use client";

import { useEffect, useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
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
    <main className="space-y-7">
      <PageHeader back="/perfil" eyebrow="Perfil" title="Preguntas frecuentes" />

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : faqs.length === 0 ? (
        <EmptyState icon={HelpCircle}>Tu entrenadora aún no ha publicado preguntas.</EmptyState>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {faqs.map((f) => {
            const isOpen = open === f.id;
            return (
              <li key={f.id}>
                <button onClick={() => setOpen(isOpen ? null : f.id)} aria-expanded={isOpen}
                  aria-controls={`faq-${f.id}`}
                  className="flex w-full items-start justify-between gap-3 py-4 text-left text-sm font-medium">
                  {f.question}
                  <ChevronDown size={20} strokeWidth={1.75} aria-hidden
                    className={`shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <p id={`faq-${f.id}`} className="whitespace-pre-line pb-4 pr-8 text-sm text-muted">
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
