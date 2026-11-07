"use client";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeadlineChip, ReadinessBar } from "./ui";

export interface KCard {
  id: string;
  status: string;
  slug: string;
  name: string;
  provider: string | null;
  amount: string;
  daysLeft: number | null;
  closed: boolean;
  readiness: number;
  ready: number;
  total: number;
  notes: string | null;
  renewal_due: string | null;
  conflict: boolean;
}

const COLS = [
  { k: "saved", l: "Saved", tone: "bg-cream-2" },
  { k: "preparing", l: "Preparing", tone: "bg-yellow" },
  { k: "applied", l: "Applied", tone: "bg-blue" },
  { k: "awaiting", l: "Awaiting result", tone: "bg-pink" },
  { k: "disbursed", l: "Disbursed", tone: "bg-green" },
  { k: "renewal_due", l: "Renewal due", tone: "bg-cream-3" },
];

export function Kanban({ cards }: { cards: KCard[] }) {
  const router = useRouter();
  const [items, setItems] = useState(cards);
  const [drag, setDrag] = useState<string | null>(null);
  const [renewFor, setRenewFor] = useState<string | null>(null);
  const [renewDate, setRenewDate] = useState("");

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch("/api/applications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...body }) });
    router.refresh();
  }
  function move(id: string, status: string) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
    if (status === "disbursed") setRenewFor(id);
    patch(id, { status });
  }
  async function remove(id: string) {
    setItems((xs) => xs.filter((x) => x.id !== id));
    await fetch(`/api/applications?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLS.map((c) => {
          const col = items.filter((x) => x.status === c.k);
          return (
            <div key={c.k} onDragOver={(e) => e.preventDefault()} onDrop={() => drag && move(drag, c.k)} className="w-72 shrink-0 rounded-[22px] bg-cream-2/60 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className={`pill px-3 py-1 text-xs font-semibold ${c.tone}`}>{c.l}</span>
                <span className="text-xs font-semibold text-muted">{col.length}</span>
              </div>
              <div className="min-h-24 space-y-2">
                {col.map((x) => (
                  <div key={x.id} draggable onDragStart={() => setDrag(x.id)} className="cursor-grab rounded-[16px] bg-white p-3 active:cursor-grabbing">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/scholarships/${x.slug}`} className="text-sm font-semibold leading-snug hover:underline">{x.name}</Link>
                      <button aria-label="Remove" onClick={() => remove(x.id)} className="text-muted"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <p className="text-xs text-muted">{x.amount}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {["saved", "preparing"].includes(x.status) ? <DeadlineChip days={x.daysLeft} closed={x.closed} /> : <span />}
                      <select aria-label="Move to" value={x.status} onChange={(e) => move(x.id, e.target.value)} className="rounded-full border border-line px-2 py-0.5 text-[11px] lg:hidden">
                        {COLS.map((o) => <option key={o.k} value={o.k}>{o.l}</option>)}
                      </select>
                    </div>
                    {["saved", "preparing"].includes(x.status) && <div className="mt-2"><ReadinessBar value={x.readiness} ready={x.ready} total={x.total} /></div>}
                    {x.renewal_due && <p className="mt-2 text-[11px] font-semibold">Renewal by {x.renewal_due}</p>}
                    {x.conflict && <p className="mt-2 text-[11px] text-pink-deep">May not be combinable with another scholarship you&apos;re tracking.</p>}
                    <textarea defaultValue={x.notes ?? ""} onBlur={(e) => e.target.value !== (x.notes ?? "") && patch(x.id, { notes: e.target.value })} placeholder="Notes" rows={1} className="mt-2 w-full resize-none rounded-lg bg-cream px-2 py-1 text-xs outline-none" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {renewFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => setRenewFor(null)}>
          <div className="w-full max-w-sm rounded-[22px] bg-cream p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Congratulations</h3>
            <p className="mt-1 text-sm text-muted">Does this scholarship need renewing? Add the date and we&apos;ll remind you two weeks before.</p>
            <input type="date" className="input mt-4" value={renewDate} onChange={(e) => setRenewDate(e.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn btn-outline" onClick={() => setRenewFor(null)}>Skip</button>
              <button className="btn btn-primary" onClick={() => { patch(renewFor, { renewal_due: renewDate }); setRenewFor(null); }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
