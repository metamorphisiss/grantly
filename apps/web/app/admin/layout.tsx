import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin } = await requireUser();
  if (!isAdmin) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-7xl p-5">
      <header className="mb-6 flex items-center justify-between rounded-[22px] bg-ink px-5 py-3 text-white">
        <Link href="/admin" className="text-xl font-bold">grantly <span className="font-normal text-white/50">admin</span></Link>
        <Link href="/dashboard" className="text-sm text-white/70 hover:text-white">Back to app</Link>
      </header>
      {children}
    </div>
  );
}
