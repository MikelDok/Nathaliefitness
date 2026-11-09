import BottomNav from "@/components/BottomNav";
import AuthGate from "@/components/AuthGate";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="mx-auto max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        {children}
        <BottomNav />
      </div>
    </AuthGate>
  );
}
