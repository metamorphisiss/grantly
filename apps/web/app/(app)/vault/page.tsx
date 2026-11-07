import { docStatuses } from "@grantly/core";
import { VaultClient, type VaultDoc } from "@/components/VaultClient";
import { loadDocuments, loadScholarships, rankAll, requireProfile } from "@/lib/data";

export default async function Vault({ searchParams }: { searchParams: Promise<{ upload?: string; q?: string }> }) {
  const sp = await searchParams;
  const { row, profile } = await requireProfile();
  const [list, docs] = await Promise.all([loadScholarships(), loadDocuments()]);
  const rows = rankAll(list, profile, docs).filter((r) => !r.e.closed && r.e.verdict !== "not_eligible");
  const used = new Map<string, number>();
  for (const r of rows) for (const t of r.s.required_documents) used.set(t, (used.get(t) ?? 0) + 1);
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);

  let items: VaultDoc[] = docs.map((d) => ({
    id: d.id,
    doc_type: d.doc_type,
    file_name: d.file_name,
    issued_on: d.issued_on ?? null,
    valid_until: d.valid_until ?? null,
    state: docStatuses([d.doc_type], [d], now, in30)[0].state,
    usedBy: used.get(d.doc_type) ?? 0,
    confirmed: d.confirmed,
    extract_status: d.extract_status,
    fields: d.confirmed ? Object.entries(d.extracted ?? {}).map(([k, v]) => [k, v.value]) : [],
  }));
  if (sp.q) items = items.filter((d) => `${d.doc_type} ${d.file_name ?? ""}`.toLowerCase().includes(sp.q!.toLowerCase()));
  const missing = [...used.entries()].filter(([t]) => !docs.some((d) => d.doc_type === t)).sort((a, b) => b[1] - a[1]).map(([doc_type, usedBy]) => ({ doc_type, usedBy }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Document vault</h1>
        <p className="mt-1 text-sm text-muted">Upload once, reuse everywhere. Replacing a document updates readiness for every scholarship.</p>
      </div>
      <VaultClient docs={items} missing={missing} profile={row} openType={sp.upload} />
    </div>
  );
}
