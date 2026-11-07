import { getUser } from "@/lib/supabase";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Circle, HalfCircle, Star4, Triangle, VerdictBadge } from "@/components/ui";

export default async function Landing() {
  const user = process.env.NEXT_PUBLIC_SUPABASE_URL ? await getUser() : null;
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      <header className="flex items-center justify-between">
        <span className="text-2xl font-bold tracking-tight">grantly</span>
        <div className="flex gap-2">
          <Link href="/login" className="btn btn-outline">Log in</Link>
          <Link href="/onboarding" className="btn btn-primary">Get started</Link>
        </div>
      </header>

      <section className="mt-14 grid items-center gap-10 lg:grid-cols-2">
        <div>
          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">Find scholarships you actually qualify for.</h1>
          <p className="mt-5 max-w-lg text-lg text-muted">Answer a few questions. See every match with the reason behind it, the documents you still need, and what to do this week.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/onboarding" className="btn btn-primary">Check my eligibility</Link>
            <Link href="/login?next=/add-link" className="btn btn-outline">Paste a scholarship link</Link>
          </div>
          <p className="mt-4 text-sm text-muted">No account needed to see your matches.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="card bg-green p-5">
            <Circle className="absolute -right-8 -top-8 h-32 w-32 text-black/10" />
            <VerdictBadge v="eligible" />
            <p className="mt-4 font-semibold">Merit scholarship</p>
            <p className="text-sm text-ink/70">Matches income, course and state</p>
          </div>
          <div className="card bg-yellow p-5 mt-8">
            <HalfCircle className="absolute -right-6 -top-4 h-32 w-32 text-black/10" />
            <VerdictBadge v="almost" />
            <p className="mt-4 font-semibold">Need-based grant</p>
            <p className="text-sm text-ink/70">Your income certificate has expired</p>
          </div>
          <div className="card bg-blue p-5">
            <Star4 className="absolute -right-8 -top-8 h-32 w-32 text-black/10" />
            <VerdictBadge v="need_info" />
            <p className="mt-4 font-semibold">State scheme</p>
            <p className="text-sm text-ink/70">Add your state of domicile</p>
          </div>
          <div className="card bg-pink p-5 mt-8">
            <Triangle className="absolute -right-6 -top-6 h-32 w-32 text-black/10" />
            <VerdictBadge v="not_eligible" />
            <p className="mt-4 font-semibold">PG fellowship</p>
            <p className="text-sm text-ink/70">Requires a postgraduate course</p>
          </div>
        </div>
      </section>

      <section className="mt-20 grid gap-4 md:grid-cols-3">
        {[
          ["1", "Tell us about you", "Eight quick questions. Skip anything you like."],
          ["2", "See real matches", "Every verdict explains itself, criterion by criterion."],
          ["3", "Apply with a plan", "Documents, deadlines and reminders in one place."],
        ].map(([n, t, b]) => (
          <div key={n} className="card bg-cream-2 p-6">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm font-bold text-white">{n}</span>
            <h3 className="mt-4 text-lg font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-muted">{b}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
