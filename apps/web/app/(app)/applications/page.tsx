import Link from "next/link";
import { evaluate, formatAmount } from "@grantly/core";
import { Kanban, type KCard } from "@/components/Kanban";
import { Empty } from "@/components/ui";
import { loadApplications, loadDocuments, loadScholarships, requireProfile } from "@/lib/data";

export default async function Applications({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const { profile } = await requireProfile();
  const [apps, docs, list] = await Promise.all([loadApplications(), loadDocuments(), loadScholarships()]);
  const byId = new Map(list.map((s) => [s.id, s]));
  const groupCount = new Map<string, number>();
  for (const a of apps) {
    const g = byId.get(a.scholarship_id)?.exclusive_group;
    if (g && !["disbursed"].includes(a.status)) groupCount.set(g, (groupCount.get(g) ?? 0) + 1);
  }
  let cards: KCard[] = apps.flatMap((a) => {
    const s = byId.get(a.scholarship_id);
    if (!s) return [];
    const e = evaluate(s, profile, docs);
    const ready = e.docs.filter((d) => d.state === "ready" || d.state === "expiring").length;
    return [{
      id: a.id, status: a.status, slug: s.slug, name: s.name, provider: s.provider ?? null, amount: formatAmount(s),
      daysLeft: e.daysLeft, closed: e.closed, readiness: e.readiness, ready, total: e.docs.length,
      notes: a.notes, renewal_due: a.renewal_due, conflict: !!s.exclusive_group && (groupCount.get(s.exclusive_group) ?? 0) > 1,
    }];
  });
  if (sp.q) cards = cards.filter((c) => c.name.toLowerCase().includes(sp.q!.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Applications</h1>
        <p className="mt-1 text-sm text-muted">Drag cards between columns. Deadline reminders stop once you mark something as applied.</p>
      </div>
      {cards.length ? <Kanban cards={cards} /> : <Empty title="No applications yet" body="Save or start a scholarship from Discover and it will show up here." action={<Link href="/discover" className="btn btn-primary">Find scholarships</Link>} />}
    </div>
  );
}
