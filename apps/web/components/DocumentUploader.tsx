"use client";
import { DOC_TYPES } from "@grantly/core";
import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CATEGORY_OPTS, STATE_OPTS } from "@/lib/options";
import { NeedsPassword, downscaleImage, heicToJpeg, readPdf, withTimeout } from "@/lib/pdf-client";
import { browserClient } from "@/lib/supabase-browser";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif";
const MAX = 10 * 1024 * 1024;
const TOTAL_CAP_MS = 45000;

type Field = { value: unknown; confidence: number };
type Result = { status: string; fields: Record<string, Field>; issued_on: string | null; valid_until: string | null; reason?: string };

const FIELDS_BY_TYPE: Record<string, { key: string; label: string; kind: "number" | "text" | "select"; opts?: { v: string; l: string }[] }[]> = {
  marksheet: [
    { key: "marks_system", label: "Marks type", kind: "select", opts: [{ v: "percent", l: "Percentage" }, { v: "cgpa", l: "CGPA" }] },
    { key: "marks_value", label: "Marks", kind: "number" },
    { key: "cgpa_scale", label: "CGPA scale (10 or 4)", kind: "number" },
  ],
  income_certificate: [{ key: "family_income_inr", label: "Annual family income (₹)", kind: "number" }],
  category_certificate: [{ key: "category", label: "Category", kind: "select", opts: CATEGORY_OPTS }],
  domicile_certificate: [{ key: "state", label: "State", kind: "select", opts: STATE_OPTS }],
};

export function DocumentUploader({ defaultType, profile, onDone, compact = false }: { defaultType?: string; profile: Record<string, unknown>; onDone?: () => void; compact?: boolean }) {
  const sb = browserClient();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [type, setType] = useState(defaultType ?? "income_certificate");
  const [stage, setStage] = useState<"idle" | "working" | "confirm" | "done">("idle");
  const [step, setStep] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [pick, setPick] = useState<Record<string, "doc" | "typed">>({});
  const [password, setPassword] = useState("");
  const [askPassword, setAskPassword] = useState(false);
  const [pending, setPending] = useState<File | null>(null);

  const docType = defaultType ?? type;

  async function upload(path: string, blob: Blob, contentType: string) {
    const { error } = await sb.storage.from("documents").upload(path, blob, { contentType, upsert: true });
    if (error) throw new Error(error.message);
  }

  async function process(id: string, body: Record<string, unknown>): Promise<Result> {
    const r = await fetch(`/api/documents/${id}/process`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Could not read the document");
    return j;
  }

  function showConfirm(res: Result) {
    const v: Record<string, string> = {};
    for (const f of FIELDS_BY_TYPE[docType] ?? []) v[f.key] = res.fields[f.key]?.value != null ? String(res.fields[f.key].value) : "";
    v.issued_on = res.issued_on ?? "";
    v.valid_until = res.valid_until ?? "";
    setVals(v);
    setPick(Object.fromEntries(Object.keys(res.fields).map((k) => [k, "doc"])));
    setResult(res);
    setStage("confirm");
  }

  async function start(file: File, pw?: string) {
    setErr(null);
    if (file.size > MAX) return setErr("File is larger than 10 MB.");
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    setStage("working");
    let id = docId;
    try {
      if (!id) {
        setStep("Saving file");
        const r = await fetch("/api/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ doc_type: docType, file_name: file.name, ext }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Upload failed");
        id = j.id as string;
        setDocId(id);
        await upload(j.path, file, file.type || "application/octet-stream");
      }
      const folder = (await sb.auth.getUser()).data.user!.id + "/" + id;
      const res = await withTimeout(read(file, ext, folder, id, pw), TOTAL_CAP_MS);
      showConfirm(res);
    } catch (e) {
      if (e instanceof NeedsPassword) {
        setPending(file);
        setAskPassword(true);
        setStage("idle");
        return;
      }
      const reason = (e as Error).message === "timeout" ? "Reading took too long" : (e as Error).message;
      if (id) await process(id, { mode: "manual", reason }).catch(() => {});
      showConfirm({ status: "manual", fields: {}, issued_on: null, valid_until: null, reason });
    }
  }

  async function read(file: File, ext: string, folder: string, id: string, pw?: string): Promise<Result> {
    if (ext === "pdf") {
      setStep("Opening PDF");
      const pdf = await readPdf(file, pw);
      if (pdf.text.replace(/\s/g, "").length > 150) {
        setStep("Reading text");
        return process(id, { mode: "text", text: pdf.text });
      }
      setStep("Scanned PDF: preparing pages");
      const imgs = await pdf.renderImages();
      const paths: string[] = [];
      for (let i = 0; i < imgs.length; i++) {
        const p = `${folder}/page-${i + 1}.png`;
        await upload(p, imgs[i], "image/png");
        paths.push(p);
      }
      setStep("Reading scanned pages");
      return process(id, { mode: "images", paths });
    }
    setStep("Preparing image");
    let blob: Blob = file;
    if (ext === "heic" || ext === "heif") blob = await heicToJpeg(file);
    blob = await downscaleImage(blob);
    const p = `${folder}/page-1.jpg`;
    await upload(p, blob, "image/jpeg");
    setStep("Reading image");
    return process(id, { mode: "images", paths: [p] });
  }

  async function confirm() {
    if (!docId) return;
    const fields: Record<string, unknown> = {};
    for (const f of FIELDS_BY_TYPE[docType] ?? []) {
      const v = vals[f.key];
      if (v === "" || v == null) continue;
      if (pick[f.key] === "typed") continue;
      fields[f.key] = f.kind === "number" ? Number(v) : v;
    }
    const r = await fetch(`/api/documents/${docId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ fields, issued_on: vals.issued_on || null, valid_until: vals.valid_until || null }) });
    if (!r.ok) return setErr((await r.json()).error ?? "Could not save");
    setStage("done");
    setDocId(null);
    router.refresh();
    onDone?.();
  }

  if (stage === "confirm" && result) {
    const defs = FIELDS_BY_TYPE[docType] ?? [];
    const found = Object.keys(result.fields).length > 0;
    return (
      <div className="space-y-4 rounded-[18px] bg-white p-4">
        <p className="font-semibold">{found ? "Check what we read" : "Add the details"} from your {DOC_TYPES[docType]?.label.toLowerCase() ?? "document"}</p>
        {!found && (
          <p className="text-sm text-muted">
            {result.status === "queued" ? "We couldn't read it right now and will try again in the background. " : "We couldn't read it clearly. "}
            The file is saved in your vault. Type the details below to use them now.
          </p>
        )}
        {defs.map((f) => {
          const conf = result.fields[f.key]?.confidence;
          const typed = profile[f.key];
          const differs = typed != null && vals[f.key] !== "" && String(typed) !== vals[f.key] && result.fields[f.key];
          return (
            <div key={f.key}>
              <span className="label">
                {f.label}
                {conf != null && conf < 0.7 && <span className="ml-2 text-pink-deep">please check</span>}
              </span>
              {f.kind === "select" ? (
                <select className="input" value={vals[f.key] ?? ""} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}>
                  <option value="">Not set</option>
                  {f.opts!.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              ) : (
                <input className="input" inputMode={f.kind === "number" ? "decimal" : "text"} value={vals[f.key] ?? ""} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
              )}
              {differs && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="text-muted">You entered {String(typed)} earlier. Keep:</span>
                  <button data-on={pick[f.key] !== "typed"} className="choice !py-1 !text-xs" onClick={() => setPick({ ...pick, [f.key]: "doc" })}>This value</button>
                  <button data-on={pick[f.key] === "typed"} className="choice !py-1 !text-xs" onClick={() => setPick({ ...pick, [f.key]: "typed" })}>What I entered</button>
                </div>
              )}
            </div>
          );
        })}
        <div className="grid grid-cols-2 gap-3">
          <div><span className="label">Issued on</span><input type="date" className="input" value={vals.issued_on ?? ""} onChange={(e) => setVals({ ...vals, issued_on: e.target.value })} /></div>
          <div><span className="label">Valid until</span><input type="date" className="input" value={vals.valid_until ?? ""} onChange={(e) => setVals({ ...vals, valid_until: e.target.value })} /></div>
        </div>
        <button onClick={confirm} className="btn btn-primary w-full">Save</button>
        {err && <p className="text-sm text-pink-deep">{err}</p>}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${compact ? "" : "rounded-[18px] bg-white p-4"}`}>
      {!defaultType && (
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      )}
      {askPassword && pending && (
        <div className="space-y-2 rounded-[14px] bg-cream-2 p-3">
          <p className="text-sm">This PDF is password protected. The password stays on your device.</p>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn btn-primary !py-2" onClick={() => { setAskPassword(false); start(pending, password); }}>Open</button>
            <button className="btn btn-outline !py-2" onClick={() => { setAskPassword(false); if (docId) process(docId, { mode: "manual", reason: "password not given" }).then(showConfirm).catch(() => showConfirm({ status: "manual", fields: {}, issued_on: null, valid_until: null })); }}>Skip, type details</button>
          </div>
        </div>
      )}
      <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) start(f); }} />
      <button onClick={() => input.current?.click()} disabled={stage === "working"} className="btn btn-primary w-full">
        {stage === "working" ? <><Loader2 className="h-4 w-4 animate-spin" />{step}</> : <><Upload className="h-4 w-4" />{stage === "done" ? "Upload another" : "Upload file"}</>}
      </button>
      {stage === "done" && <p className="text-sm font-medium text-green-deep">Saved. Your matches are updated.</p>}
      {err && <p className="text-sm text-pink-deep">{err}</p>}
      <p className="text-[11px] text-muted">PDF, JPG, PNG or HEIC up to 10 MB. We keep only the details you confirm, never ID numbers.</p>
    </div>
  );
}
