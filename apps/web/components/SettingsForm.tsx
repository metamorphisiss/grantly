"use client";
import { useState } from "react";

export function SettingsForm({ email, days }: { email: boolean; days: number[] }) {
  const [deleting, setDeleting] = useState(false);
  const [on, setOn] = useState(email);
  const [d, setD] = useState(days.join(", "));
  const [saved, setSaved] = useState(false);

  async function save() {
    const reminder_days = d.split(",").map((x) => Number(x.trim())).filter((n) => n > 0);
    const r = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ reminder_email: on, reminder_days }) });
    setSaved(r.ok);
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-4 bg-cream-2 p-5">
        <h2 className="text-lg font-semibold">Reminders</h2>
        <label className="flex items-center justify-between gap-4">
          <span><span className="block font-medium">Email digest</span><span className="text-xs text-muted">One email a day at most, around 8 AM IST, only when something is due.</span></span>
          <input type="checkbox" className="h-5 w-5 accent-black" checked={on} onChange={(e) => { setOn(e.target.checked); setSaved(false); }} />
        </label>
        <label className="block">
          <span className="label">Days before a deadline</span>
          <input className="input" value={d} onChange={(e) => { setD(e.target.value); setSaved(false); }} />
          <span className="mt-1 block text-[11px] text-muted">Comma separated, for example 14, 3, 1. Applies to applications you save from now on.</span>
        </label>
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm">Saved</span>}
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </section>
      <section className="card space-y-3 bg-cream-2 p-5">
        <h2 className="text-lg font-semibold">Account and privacy</h2>
        <p className="text-sm text-muted">Deleting your account removes your profile, documents, applications and reminders permanently.</p>
        <button
          className="btn btn-outline"
          disabled={deleting}
          onClick={async () => {
            if (!confirm("Delete your account and all your data? This can't be undone.")) return;
            setDeleting(true);
            const r = await fetch("/api/account/delete", { method: "POST" });
            if (r.ok) window.location.href = "/";
            else {
              setDeleting(false);
              alert((await r.json()).error ?? "Could not delete account");
            }
          }}
        >
          {deleting ? "Deleting…" : "Delete my account"}
        </button>
      </section>
    </div>
  );
}
