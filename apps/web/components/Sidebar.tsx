"use client";
import { CalendarDays, FileText, FolderLock, LayoutGrid, Link2, LogOut, Search, Settings, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MAIN = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutGrid },
  { href: "/discover", label: "Discover", Icon: Search },
  { href: "/vault", label: "Document vault", Icon: FolderLock },
  { href: "/applications", label: "Applications", Icon: FileText },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
];
const TOOLS = [
  { href: "/add-link", label: "Add via link", Icon: Link2 },
  { href: "/profile", label: "Profile", Icon: UserRound },
  { href: "/settings", label: "Settings", Icon: Settings },
];

function Item({ href, label, Icon, active }: { href: string; label: string; Icon: typeof LayoutGrid; active: boolean }) {
  return (
    <Link href={href} className={`relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${active ? "text-pink" : "text-white/80 hover:text-white"}`}>
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-pink" />}
      <Icon className="h-4 w-4" strokeWidth={1.75} />
      {label}
    </Link>
  );
}

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const on = (h: string) => path === h || path.startsWith(h + "/");
  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-56 shrink-0 flex-col rounded-[22px] bg-ink p-5 text-white lg:flex">
      <Link href="/dashboard" className="mb-8 px-3 text-2xl font-bold tracking-tight">grantly</Link>
      <p className="mb-2 px-3 text-xs text-white/40">General</p>
      <nav className="space-y-0.5">{MAIN.map((i) => <Item key={i.href} {...i} active={on(i.href)} />)}</nav>
      <p className="mb-2 mt-6 px-3 text-xs text-white/40">Tools</p>
      <nav className="space-y-0.5">
        {TOOLS.map((i) => <Item key={i.href} {...i} active={on(i.href)} />)}
        {isAdmin && <Item href="/admin" label="Admin" Icon={ShieldCheck} active={on("/admin")} />}
      </nav>
      <div className="mt-auto">
        <form action="/auth/signout" method="post">
          <button className="flex items-center gap-3 px-3 py-2 text-sm text-white/80 hover:text-white">
            <LogOut className="h-4 w-4" strokeWidth={1.75} /> Log out
          </button>
        </form>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const path = usePathname();
  const items = [MAIN[0], MAIN[1], MAIN[2], MAIN[3], TOOLS[1]];
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-full bg-ink px-2 py-2 lg:hidden">
      {items.map(({ href, label, Icon }) => {
        const active = path.startsWith(href);
        return (
          <Link key={href} href={href} aria-label={label} className={`grid h-11 w-11 place-items-center rounded-full ${active ? "bg-pink text-ink" : "text-white/80"}`}>
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </Link>
        );
      })}
    </nav>
  );
}
