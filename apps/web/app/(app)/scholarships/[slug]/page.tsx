import { ArrowLeft, BadgeCheck, CircleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DOC_TYPES, evaluate, fieldLabel, formatAmount } from "@grantly/core";
import { ApplyActions } from "@/components/ApplyActions";
import { DeadlineChip, ReadinessBar, SectionTitle, VERDICT, VerdictBadge } from "@/components/ui";
import { loadApplications, loadDocuments, loadScholarship, requireProfile } from "@/lib/data";

const STATUS_ICON = { pass: "Met", fail: "Not met", unknown: "Missing", expired: "Expired" } as const;
const STATUS_TONE = { pass: "bg-green", fail: "bg-pink", unknown: "bg-blue", expired: "bg-yellow" } as const;
const DOC_TONE = { ready: "bg-green", expiring: "bg-yellow", expired: "bg-pink", missing: "bg-white" } as const;

export default async function Detail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { profile } = await requireProfile();
  const [s, docs, apps] = await Promise.all([loadScholarship(slug), loadDocuments(), loadApplications()]);
  if (!s) notFound();
  const e = evaluate(s, profile, docs);
  const V = VERDICT[e.verdict];
  const app = apps.find((a) => a.scholarship_id === s.id);
  const groups = new Set(s.criteria.map((c) => c.group_no)).size;
  const sameGroup = s.exclusive_group ? apps.filter((a) => a.scholarship_id !== s.id) : [];
  const ready = e.docs.filter((d) => d.state === "ready" || d.state === "expiring").length;
  const trust = s.trust as { level?: string; flags?: string[] } | undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/discover" className="inline-flex items-center gap-2 text-sm text-muted"><ArrowLeft className="h-4 w-4" />Back to Discover</Link>

      <header className={`card ${V.bg} p-6`}>
        <V.Shape className="absolute -right-10 -top-10 h-52 w-52 text-black/10" />
        <div className="relative flex flex-wrap items-center gap-2">
          <VerdictBadge v={e.verdict} />
          <DeadlineChip days={e.daysLeft} type={s.deadline_type} closed={e.closed} />
          {s.visibility === "private" && <span className="pill bg-white px-3 py-1 text-xs font-semibold">Added by you, unverified</span>}
        </div>
        <h1 className="relative mt-4 text-3xl font-bold tracking-tight">{s.name}</h1>
        <p className="relative mt-1 flex flex-wrap items-center gap-2 text-sm text-ink/70">
          {s.provider}
          {s.last_verified && s.visibility === "public" && (
            <span className="inline-flex items-center gap-1"><BadgeCheck className="h-4 w-4" />Verified {new Date(s.last_verified).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
          )}
          {s.source_url && <a className="underline underline-offset-2" href={s.source_url} target="_blank" rel="noopener noreferrer">Official source</a>}
        </p>
        <div className="relative mt-5 flex flex-wrap gap-6">
          <div><div className="text-2xl font-bold">{formatAmount(s)}</div><div className="text-xs text-ink/60">{s.renewable ? "Renewable" : "Amount"}</div></div>
          <div><div className="text-2xl font-bold">{s.deadline ? new Date(s.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : s.deadline_type === "rolling" ? "Rolling" : "Not stated"}</div><div className="text-xs text-ink/60">Deadline{s.scope === "international" ? " (check the provider's time zone)" : " (IST)"}</div></div>
        </div>
        <p className="relative mt-5 text-sm font-medium">{e.reason}</p>
      </header>

      {trust?.level === "warning" && (
        <div className="flex gap-3 rounded-[18px] border-[1.5px] border-ink bg-pink p-4 text-sm">
          <CircleAlert className="h-5 w-5 shrink-0" />
          <div><b>Possible scam.</b> {trust.flags?.join(". ")}. Never pay a fee or share an OTP to apply for a scholarship.</div>
        </div>
      )}

      <section className="card bg-cream-2 p-5">
        <SectionTitle>Why this verdict</SectionTitle>
        {groups > 1 && <p className="mb-3 text-xs text-muted">This scholarship has {groups} alternative ways to qualify. Showing the one closest to you.</p>}
        {e.results.length === 0 ? (
          <p className="text-sm text-muted">{s.track_only ? "We could not read eligibility rules from this page. Check the official source." : "No rules recorded."}</p>
        ) : (
          <div className="divide-y divide-line">
            {e.results.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 sm:grid-cols-[180px_1fr_1fr_auto]">
                <span className="font-semibold">{fieldLabel(r.criterion.field)}</span>
                <span className="hidden text-sm sm:block"><span className="text-muted">Required: </span>{r.required}</span>
                <span className="hidden text-sm sm:block"><span className="text-muted">You: </span>{r.yours ?? (r.status === "unknown" ? <Link href="/profile" className="underline">add to profile</Link> : "—")}</span>
                <span className={`pill px-3 py-1 text-xs font-semibold ${STATUS_TONE[r.status]}`}>{STATUS_ICON[r.status]}</span>
                {(r.hint || r.criterion.evidence) && (
                  <p className="col-span-full -mt-1 text-xs text-muted">
                    {r.hint}
                    {r.criterion.evidence && <span className="block italic">Source: &ldquo;{r.criterion.evidence}&rdquo;</span>}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        {s.other_conditions.length > 0 && (
          <div className="mt-4 rounded-[14px] bg-white p-4 text-sm">
            <p className="font-semibold">Other conditions</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-ink/80">{s.other_conditions.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
        )}
      </section>

      <section className="card bg-cream-2 p-5">
        <SectionTitle right={<Link href="/vault" className="pill bg-ink px-4 py-1.5 text-xs font-semibold text-white">Open vault</Link>}>Documents</SectionTitle>
        <ReadinessBar value={e.readiness} ready={ready} total={e.docs.length} />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {e.docs.map((d) => (
            <div key={d.doc_type} className={`flex items-center justify-between rounded-[14px] px-4 py-3 ${DOC_TONE[d.state]}`}>
              <span className="text-sm font-medium">{DOC_TYPES[d.doc_type]?.label ?? d.doc_type}</span>
              {d.state === "missing" || d.state === "expired" ? (
                <Link href={`/vault?upload=${d.doc_type}`} className="pill bg-ink px-3 py-1 text-xs font-semibold text-white">{d.state === "expired" ? "Replace" : "Upload"}</Link>
              ) : (
                <span className="text-xs font-semibold">{d.state === "expiring" ? "Expires before deadline" : "Ready"}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {s.steps.length > 0 && (
        <section className="card bg-cream-2 p-5">
          <SectionTitle>How to apply</SectionTitle>
          <ol className="grid gap-3 sm:grid-cols-2">
            {s.steps.map((st, i) => (
              <li key={i} className="flex gap-3 rounded-[14px] bg-white p-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">{i + 1}</span>
                <span><span className="block text-sm font-semibold">{st.title}</span>{st.detail && <span className="text-xs text-muted">{st.detail}</span>}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {s.exclusive_group && sameGroup.length > 0 && (
        <p className="rounded-[14px] border-[1.5px] border-dashed border-ink p-3 text-sm">Some scholarships in this group can&apos;t be held together. Check the rules before accepting more than one.</p>
      )}

      <ApplyActions scholarshipId={s.id} status={app?.status ?? null} applyUrl={s.apply_url ?? s.source_url ?? null} />
    </div>
  );
}
