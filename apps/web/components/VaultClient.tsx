"use client";
import { DOC_TYPES } from "@grantly/core";
import { FileText, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DocumentUploader } from "./DocumentUploader";

export interface VaultDoc {
  id: string;
  doc_type: string;
  file_name: string | null;
  issued_on: string | null;
  valid_until: string | null;
  state: "ready" | "expiring" | "expired" | "missing";
  usedBy: number;
  confirmed: boolean;
  extract_status: string;
  fields: [string, unknown][];
}

const TONE = { ready: "bg-green", expiring: "bg-yellow", expired: "bg-pink", missing: "bg-cream-2" };
const STATE_LABEL = { ready: "Valid", expiring: "Expiring soon", expired: "Expired", missing: "Missing" };

export function VaultClient({ docs, missing, profile, openType }: { docs: VaultDoc[]; missing: { doc_type: string; usedBy: number }[]; profile: Record<string, unknown>; openType?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(openType ?? null);
  async function remove(id: string) {
    if (!confirm("Delete this document? Readiness will update for every scholarship.")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    router.refresh();
  }
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {docs.map((d) => (
            <div key={d.id} className={`card ${TONE[d.state]} p-5`}>
              <FileText className="absolute -right-4 -top-4 h-24 w-24 text-black/10" strokeWidth={1} />
              <div className="relative flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{DOC_TYPES[d.doc_type]?.label ?? d.doc_type}</p>
                  <p className="truncate text-xs text-ink/60">{d.file_name}</p>
                </div>
                <span className="pill bg-white px-3 py-1 text-xs font-semibold">{STATE_LABEL[d.state]}</span>
              </div>
              <dl className="relative mt-4 grid grid-cols-2 gap-2 text-xs">
                <div><dt className="text-ink/60">Issued</dt><dd className="font-semibold">{d.issued_on ?? "—"}</dd></div>
                <div><dt className="text-ink/60">Valid until</dt><dd className="font-semibold">{d.valid_until ?? "No expiry"}</dd></div>
                {d.fields.map(([k, v]) => (
                  <div key={k}><dt className="text-ink/60">{k.replace(/_/g, " ").replace(" inr", "")}</dt><dd className="font-semibold">{String(v)}</dd></div>
                ))}
              </dl>
              <div className="relative mt-4 flex items-center justify-between">
                <span className="text-xs font-semibold">Used by {d.usedBy} scholarship{d.usedBy === 1 ? "" : "s"}</span>
                <div className="flex gap-2">
                  {!d.confirmed && d.extract_status !== "pending" && <span className="pill bg-white/70 px-2.5 py-0.5 text-[11px]">Not confirmed</span>}
                  {d.extract_status === "pending" && <span className="pill bg-white/70 px-2.5 py-0.5 text-[11px]">Reading…</span>}
                  <button aria-label="Delete document" onClick={() => remove(d.id)} className="grid h-8 w-8 place-items-center rounded-full bg-white"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {missing.length > 0 && (
          <div>
            <h2 className="mb-3 text-xl font-semibold">Missing for your matches</h2>
            <div className="space-y-2">
              {missing.map((m) => (
                <div key={m.doc_type} className="rounded-[18px] border-[1.5px] border-dashed border-line p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{DOC_TYPES[m.doc_type]?.label ?? m.doc_type}</p>
                      <p className="text-xs text-muted">Needed by {m.usedBy} of your matches</p>
                    </div>
                    <button className="btn btn-outline !py-2" onClick={() => setOpen(open === m.doc_type ? null : m.doc_type)}>{open === m.doc_type ? "Close" : "Upload"}</button>
                  </div>
                  {open === m.doc_type && <div className="mt-3"><DocumentUploader defaultType={m.doc_type} profile={profile} compact /></div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <aside className="card h-fit bg-cream-2 p-5">
        <h2 className="mb-3 text-lg font-semibold">Upload a document</h2>
        <DocumentUploader profile={profile} compact />
      </aside>
    </div>
  );
}
