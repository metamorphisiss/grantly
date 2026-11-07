"use client";
import { Bookmark, ExternalLink, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApplyActions({ scholarshipId, status, applyUrl }: { scholarshipId: string; status: string | null; applyUrl: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function set(s: string) {
    setBusy(true);
    await fetch("/api/applications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scholarship_id: scholarshipId, status: s }) });
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status ? (
        <Link href="/applications" className="btn btn-primary">In your tracker: {status.replace("_", " ")}</Link>
      ) : (
        <>
          <button disabled={busy} onClick={() => set("preparing")} className="btn btn-primary"><Play className="h-4 w-4" />Start application</button>
          <button disabled={busy} onClick={() => set("saved")} className="btn btn-outline"><Bookmark className="h-4 w-4" />Save</button>
        </>
      )}
      {applyUrl && <a href={applyUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline"><ExternalLink className="h-4 w-4" />Official site</a>}
    </div>
  );
}
