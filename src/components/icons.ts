import { Bug, CalendarDays, Lightbulb, MapPin, MessageSquare, Video, type LucideIcon } from "lucide-react";
import type { AppointmentKind } from "@/lib/agenda";
import type { SuggestionKind } from "@/lib/suggestions";

/** Icono de cada tipo de cita (clienta y panel). */
export const APPOINTMENT_ICON: Record<AppointmentKind, LucideIcon> = {
  presencial: MapPin,
  videollamada: Video,
  otro: CalendarDays,
};

/** Icono de cada tipo de sugerencia (clienta y panel). */
export const SUGGESTION_ICON: Record<SuggestionKind, LucideIcon> = {
  fallo: Bug,
  idea: Lightbulb,
  otro: MessageSquare,
};
