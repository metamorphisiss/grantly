import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { Profile, Scholarship, evaluate, priority, type Evaluation, type UserDocument } from "@grantly/core";
import { anonClient, getUser, userClient } from "./supabase";

export interface Row {
  s: Scholarship;
  e: Evaluation;
  score: number;
  tight: boolean;
}

const SELECT = "*, scholarship_criteria(*), scholarship_documents(doc_type, required), scholarship_steps(position, title, detail)";

type DbScholarship = Record<string, unknown> & {
  scholarship_criteria?: Record<string, unknown>[];
  scholarship_documents?: { doc_type: string; required: boolean }[];
  scholarship_steps?: { position: number; title: string; detail: string | null }[];
};

export function toScholarship(r: DbScholarship): Scholarship {
  return Scholarship.parse({
    ...r,
    amount_min: r.amount_min == null ? null : Number(r.amount_min),
    amount_max: r.amount_max == null ? null : Number(r.amount_max),
    other_conditions: r.other_conditions ?? [],
    criteria: (r.scholarship_criteria ?? []).map((c) => ({ ...c, confidence: Number(c.confidence ?? 1) })),
    required_documents: (r.scholarship_documents ?? []).filter((d) => d.required).map((d) => d.doc_type),
    steps: [...(r.scholarship_steps ?? [])].sort((a, b) => a.position - b.position).map(({ title, detail }) => ({ title, detail })),
  });
}

export function toProfile(r: Record<string, unknown> | null): Profile {
  if (!r) return Profile.parse({});
  return Profile.parse({
    ...r,
    marks_value: r.marks_value == null ? null : Number(r.marks_value),
    cgpa_scale: r.cgpa_scale == null ? null : Number(r.cgpa_scale),
    family_income_inr: r.family_income_inr == null ? null : Number(r.family_income_inr),
    english_test_score: r.english_test_score == null ? null : Number(r.english_test_score),
    work_experience_years: r.work_experience_years == null ? null : Number(r.work_experience_years),
  });
}

export const loadProfileRow = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  const db = await userClient();
  const { data } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data as Record<string, unknown> | null;
});

export const requireUser = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/login");
  const row = await loadProfileRow();
  return { userId: user.id, email: user.email ?? null, isAdmin: !!row?.is_admin };
});

export const requireProfile = cache(async () => {
  const u = await requireUser();
  const row = await loadProfileRow();
  if (!row || !row.onboarded_at) redirect("/onboarding");
  return { ...u, row, profile: toProfile(row) };
});

export const loadDocuments = cache(async () => {
  const db = (await userClient());
  const { data } = await db.from("documents").select("*").order("created_at", { ascending: false });
  return (data ?? []) as (UserDocument & { storage_path: string; file_name: string | null; extracted: Record<string, { value: unknown; confidence: number }>; extract_status: string; created_at: string })[];
});

export const loadScholarships = cache(async (signedIn = true) => {
  const db = signedIn ? (await userClient()) : anonClient();
  const { data, error } = await db.from("scholarships").select(SELECT).neq("status", "archived");
  if (error) throw error;
  return (data ?? []).filter((r) => r.status === "published" || r.visibility === "private").map((r) => toScholarship(r as DbScholarship));
});

export async function loadScholarship(slug: string) {
  const db = (await userClient());
  const { data } = await db.from("scholarships").select(SELECT).eq("slug", slug).maybeSingle();
  return data ? toScholarship(data as DbScholarship) : null;
}

export function rankAll(list: Scholarship[], profile: Profile, docs: UserDocument[], now = new Date()): Row[] {
  const wantAbroad = profile.scope_pref.includes("abroad");
  const wantIndia = profile.scope_pref.includes("india");
  return list
    .filter((s) => (s.scope === "international" ? wantAbroad : wantIndia))
    .map((s) => {
      const e = evaluate(s, profile, docs, now);
      const p = priority(s, e);
      return { s, e, score: p.score, tight: p.tight };
    })
    .sort((a, b) => b.score - a.score || (a.e.daysLeft ?? 9999) - (b.e.daysLeft ?? 9999));
}

export const loadApplications = cache(async () => {
  const db = (await userClient());
  const { data } = await db.from("applications").select("*, scholarships(slug, name, provider, deadline, amount_min, amount_max, amount_currency, amount_period, coverage)").order("updated_at", { ascending: false });
  return (data ?? []) as {
    id: string;
    status: string;
    notes: string | null;
    applied_on: string | null;
    renewal_due: string | null;
    scholarship_id: string;
    scholarships: { slug: string; name: string; provider: string | null; deadline: string | null } & Record<string, unknown>;
  }[];
});
