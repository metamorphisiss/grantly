import { Suspense } from "react";
import { BottomNav, Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { requireProfile } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin } = await requireProfile();
  return (
    <div className="mx-auto flex max-w-[1440px] gap-6 p-4 pb-24 lg:pb-4">
      <Sidebar isAdmin={isAdmin} />
      <div className="min-w-0 flex-1">
        <Suspense fallback={<div className="h-11" />}>
          <TopBar />
        </Suspense>
        <div className="mt-6">{children}</div>
      </div>
      <BottomNav />
    </div>
  );
}
