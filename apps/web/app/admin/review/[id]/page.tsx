import { notFound } from "next/navigation";
import { ReviewEditor } from "@/components/ReviewEditor";
import { toScholarship } from "@/lib/data";
import { adminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Review({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await adminClient().from("scholarships").select("*, scholarship_criteria(*), scholarship_documents(doc_type, required), scholarship_steps(position, title, detail)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const s = toScholarship(data);
  const meta = (data.field_meta ?? {}) as Record<string, unknown>;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Review: {s.name}</h1>
      <p className="text-sm text-muted">Yellow tags came from the LLM, pink tags are low confidence. Click any evidence to highlight it in the source.</p>
      <ReviewEditor
        id={s.id}
        initial={{
          name: s.name,
          provider: s.provider ?? null,
          provider_type: s.provider_type ?? null,
          scope: s.scope,
          amount_min: s.amount_min ?? null,
          amount_max: s.amount_max ?? null,
          amount_currency: s.amount_currency,
          amount_period: s.amount_period ?? null,
          coverage: s.coverage ?? null,
          deadline: s.deadline ?? null,
          deadline_type: s.deadline_type,
          apply_url: s.apply_url ?? null,
          other_conditions: s.other_conditions,
          exclusive_group: s.exclusive_group ?? null,
        }}
        criteria={s.criteria}
        documents={s.required_documents}
        meta={(meta.fields ?? {}) as Record<string, { method?: string; confidence?: number; evidence?: string }>}
        sourceText={String(meta.source_text ?? "Source text not stored.")}
        sourceUrl={s.source_url ?? null}
      />
    </div>
  );
}
