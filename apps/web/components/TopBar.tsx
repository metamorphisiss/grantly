"use client";
import { Bell, Search, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const SCOPES = [
  { k: "scholarships", label: "Scholarships" },
  { k: "documents", label: "Documents" },
  { k: "applications", label: "Applications" },
];

export function TopBar() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [scope, setScope] = useState("scholarships");
  const go = () => {
    const target = scope === "documents" ? "/vault" : scope === "applications" ? "/applications" : "/discover";
    router.push(`${target}?q=${encodeURIComponent(q)}`);
  };
  return (
    <div className="flex items-center gap-3">
      <button onClick={go} aria-label="Search" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-pink">
        <Search className="h-4 w-4" />
      </button>
      <div className="flex flex-1 items-center gap-3 rounded-full border-[1.5px] border-line bg-cream px-4 py-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="Search" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        <span className="hidden text-xs text-muted md:inline">In:</span>
        <div className="hidden gap-1 md:flex">
          {SCOPES.map((s) => (
            <button key={s.k} onClick={() => setScope(s.k)} className={`pill px-3 py-1 text-[11px] font-semibold ${scope === s.k ? "bg-ink text-white" : "border border-dashed border-line text-ink"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <Link href="/calendar" aria-label="Reminders" className="hidden h-11 w-11 place-items-center rounded-full bg-ink text-white sm:grid"><Bell className="h-4 w-4" /></Link>
      <Link href="/settings" aria-label="Settings" className="hidden h-11 w-11 place-items-center rounded-full bg-ink text-white sm:grid"><Settings className="h-4 w-4" /></Link>
      <Link href="/profile" aria-label="Profile" className="grid h-11 w-11 place-items-center rounded-full bg-ink text-white"><UserRound className="h-4 w-4" /></Link>
    </div>
  );
}
