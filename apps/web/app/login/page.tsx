"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { browserClient } from "@/lib/supabase-browser";

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

function LoginInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const next = safeNext(sp.get("next"));
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(sp.get("error") ? "That sign-in link expired or was already used. Request a new one." : null);
  const google = process.env.NEXT_PUBLIC_GOOGLE_AUTH === "true";
  const sb = browserClient();
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function send() {
    setBusy(true);
    setMsg(null);
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    setBusy(false);
    if (error) {
      setMsg(/rate|limit|seconds/i.test(error.message) ? "Too many emails right now. Wait a minute and try again, or use Google sign-in." : error.message);
      return;
    }
    setStage("code");
  }

  async function verify() {
    setBusy(true);
    setMsg(null);
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) return setMsg("That code didn't work. Check the latest email, or click the link in it instead.");
    router.replace(next);
    router.refresh();
  }

  async function withGoogle() {
    await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` } });
  }

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/" className="block text-center text-3xl font-bold tracking-tight">grantly</Link>
        <div className="card space-y-4 bg-cream-2 p-6">
          {stage === "email" ? (
            <>
              <h1 className="text-xl font-semibold">Sign in or create an account</h1>
              <label className="block">
                <span className="label">Email</span>
                <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && email && send()} />
              </label>
              <button className="btn btn-primary w-full" disabled={!email || busy} onClick={send}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
              {google && (
                <>
                  <div className="text-center text-xs text-muted">or</div>
                  <button className="btn btn-outline w-full" onClick={withGoogle}>Continue with Google</button>
                </>
              )}
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold">Check your email</h1>
              <p className="text-sm text-muted">We sent a sign-in email to <b>{email}</b>. Click the link in it, or type the 6-digit code if the email shows one.</p>
              <input className="input text-center text-lg tracking-[0.4em]" inputMode="numeric" maxLength={8} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              <button className="btn btn-primary w-full" disabled={code.length < 6 || busy} onClick={verify}>{busy ? "Checking…" : "Sign in"}</button>
              <button className="w-full text-sm text-muted underline" onClick={() => setStage("email")}>Use a different email</button>
            </>
          )}
          {msg && <p className="text-sm text-pink-deep">{msg}</p>}
        </div>
      </div>
    </main>
  );
}

export default function Login() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
