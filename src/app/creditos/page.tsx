import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Créditos · NEA FITNESS" };

type Block = { kind: "h2" | "p" | "code"; text: string };

/** Markdown mínimo de THIRD_PARTY_NOTICES.md: "## título", párrafos y bloques ``` . */
function parse(md: string): Block[] {
  const blocks: Block[] = [];
  const parts = md.split(/```/);
  parts.forEach((part, i) => {
    if (i % 2 === 1) { blocks.push({ kind: "code", text: part.trim() }); return; }
    part.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).forEach((b) => {
      if (b.startsWith("# ")) return; // el título ya lo pone la página
      if (b.startsWith("## ")) blocks.push({ kind: "h2", text: b.slice(3) });
      else blocks.push({ kind: "p", text: b.replace(/\s*\n\s*/g, " ") });
    });
  });
  return blocks;
}

/** Créditos y licencias de terceros (público). Se genera en el build desde THIRD_PARTY_NOTICES.md. */
export default async function Creditos() {
  const md = await readFile(path.join(process.cwd(), "THIRD_PARTY_NOTICES.md"), "utf8");
  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-5 px-5 pb-10 pt-[calc(env(safe-area-inset-top)+2.5rem)]">
      <div>
        <p className="eyebrow">Privacidad</p>
        <h1 className="mt-2 text-[32px]">Créditos</h1>
      </div>
      {parse(md).map((b, i) =>
        b.kind === "h2" ? <h2 key={i} className="eyebrow border-b border-line pb-2 pt-3">{b.text}</h2>
        : b.kind === "code" ? <pre key={i} className="whitespace-pre-wrap break-words rounded-xl bg-surface p-4 text-[11px] leading-relaxed text-muted">{b.text}</pre>
        : <p key={i} className="break-words text-sm text-muted">{b.text}</p>,
      )}
      <Link href="/privacidad" className="block py-2 text-center text-xs text-muted">Volver</Link>
    </main>
  );
}
