import { extractFromDocument, redactIds } from "@grantly/core";
import { db, type Job } from "../db";
import { ocrImage, pdfToText } from "../ocr";

export async function ocrDocument(job: Job) {
  const id = String(job.payload.document_id);
  const { data: doc } = await db.from("documents").select("*").eq("id", id).maybeSingle();
  if (!doc) return { note: "Document was deleted" };
  if (doc.confirmed && Object.keys(doc.extracted ?? {}).length) return { note: "Already confirmed by the student" };

  const paths: string[] = Array.isArray(job.payload.paths) && job.payload.paths.length ? (job.payload.paths as string[]) : [doc.storage_path];
  let text = "";
  for (const p of paths.slice(0, 3)) {
    const { data: file, error } = await db.storage.from("documents").download(p);
    if (error || !file) continue;
    const buf: Buffer = Buffer.from(await file.arrayBuffer());
    const ext = (p.split(".").pop() ?? "").toLowerCase();
    try {
      text += "\n" + (ext === "pdf" ? (await pdfToText(buf, { maxOcrPages: 3 })).text : await ocrImage(buf, ext));
    } catch (e) {
      text += "";
      if (/password/i.test(String(e))) return markFailed(id, "PDF is password protected");
    }
  }
  const r = extractFromDocument(doc.doc_type, redactIds(text));
  const found = Object.keys(r.fields).length > 0 || !!r.issued_on;
  if (!found) return markFailed(id, "Nothing recognised");
  await db
    .from("documents")
    .update({ extracted: Object.fromEntries(Object.entries(r.fields).map(([k, v]) => [k, { ...v, confidence: Math.min(v.confidence, 0.7) }])), issued_on: doc.issued_on ?? r.issued_on, valid_until: doc.valid_until ?? r.valid_until, extract_status: "done", extract_source: "background OCR" })
    .eq("id", id);
  return { note: `Extracted ${Object.keys(r.fields).length} fields; student will be asked to confirm` };
}

async function markFailed(id: string, reason: string) {
  await db.from("documents").update({ extract_status: "failed", extract_source: `background OCR: ${reason}` }).eq("id", id);
  return { note: reason };
}
