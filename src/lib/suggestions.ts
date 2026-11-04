/** Buzón de sugerencias: tipos y estados compartidos por clienta y coach (tabla suggestions, 0013). */

export type SuggestionKind = "fallo" | "idea" | "otro";
export type SuggestionStatus = "recibida" | "leida" | "hecha";

export type Suggestion = {
  id: string;
  client_id: string;
  kind: SuggestionKind;
  body: string;
  screen: string | null;
  status: SuggestionStatus;
  coach_reply: string | null;
  created_at: string;
};

export const SUGGESTION_SELECT = "id,client_id,kind,body,screen,status,coach_reply,created_at";

export const KINDS: { value: SuggestionKind; label: string; icon: string }[] = [
  { value: "fallo", label: "Fallo", icon: "🐞" },
  { value: "idea", label: "Idea", icon: "💡" },
  { value: "otro", label: "Otro", icon: "💬" },
];

export const STATUSES: { value: SuggestionStatus; label: string }[] = [
  { value: "recibida", label: "Recibida" },
  { value: "leida", label: "Leída" },
  { value: "hecha", label: "Hecha" },
];

export const kindLabel = (k: SuggestionKind) => KINDS.find((x) => x.value === k) ?? KINDS[2];
export const statusLabel = (s: SuggestionStatus) => STATUSES.find((x) => x.value === s)?.label ?? s;

/** Clases de la etiqueta de estado (tokens de globals.css). */
export const statusTone = (s: SuggestionStatus) =>
  s === "hecha" ? "bg-ok/15 text-ok" : s === "leida" ? "bg-raised text-ink" : "bg-accent/15 text-accent";

export const BODY_MAX = 1000;
export const SCREEN_MAX = 100;
export const REPLY_MAX = 500;
