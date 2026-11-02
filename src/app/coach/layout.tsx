import CoachGate from "@/components/CoachGate";
import CoachHeader from "@/components/CoachHeader";

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <CoachGate>
      <div className="min-h-dvh">
        <CoachHeader />
        <div className="mx-auto max-w-4xl px-4 py-6">{children}</div>
      </div>
    </CoachGate>
  );
}
