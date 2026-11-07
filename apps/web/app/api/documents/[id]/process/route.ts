import { NextResponse } from "next/server";
import { extractFromDocument, redactIds } from "@grantly/core";
import { withTimeout } from "@grantly/pipeline";
import { ocrImages } from "@/lib/ocr";
import { adminClient, getUser, userClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const OCR_BUDGET_MS = 25000;

type Body = { mode: "text" | "images" | "manual"; text?: string; paths?: string[]; reason?: string };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Body;
  const db = await userClient();
  const { data: doc } = await db.from("documents").select("id, doc_type, storage_path").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  const folder = `${user.id}/${id}/`;

  const save = async (status: string, fields: Record<string, unknown>, issued: string | null, valid: string | null, source: string) => {
    await db.from("documents").update({ extract_status: status, extracted: fields, issued_on: issued, valid_until: valid, extract_source: source }).eq("id", id);
  };

  if (b.mode === "manual") {
    await save("manual", {}, null, null, `manual: ${String(b.reason ?? "").slice(0, 80)}`);
    return NextResponse.json({ status: "manual", fields: {}, issued_on: null, valid_until: null });
  }

  if (b.mode === "text") {
    const text = redactIds(String(b.text ?? "").slice(0, 60000));
    const r = extractFromDocument(doc.doc_type, text);
    const status = Object.keys(r.fields).length || r.issued_on ? "done" : "failed";
    await save(status, r.fields, r.issued_on, r.valid_until, "pdf-text");
    return NextResponse.json({ status, fields: r.fields, issued_on: r.issued_on, valid_until: r.valid_until });
  }

  const paths = (b.paths ?? []).filter((p) => typeof p === "string" && p.startsWith(folder)).slice(0, 3);
  if (!paths.length) return NextResponse.json({ error: "No images to read" }, { status: 400 });

  try {
    const images = await withTimeout(
      Promise.all(
        paths.map(async (p) => {
          const { data, error } = await db.storage.from("documents").download(p);
          if (error || !data) throw new Error("download failed");
          return Buffer.from(await data.arrayBuffer());
        }),
      ),
      8000,
      "download",
    );
    const ocr = await withTimeout(ocrImages(images, { deadlineMs: OCR_BUDGET_MS - 3000 }), OCR_BUDGET_MS, "OCR");
    const r = extractFromDocument(doc.doc_type, redactIds(ocr.text));
    const lowConf = ocr.confidence < 55;
    const fields = Object.fromEntries(Object.entries(r.fields).map(([k, v]) => [k, { ...v, confidence: lowConf ? Math.min(v.confidence, 0.5) : v.confidence }]));
    const status = Object.keys(fields).length || r.issued_on ? "done" : "failed";
    await save(status, fields, r.issued_on, r.valid_until, `ocr ${ocr.langs} ${Math.round(ocr.confidence)}% ${ocr.ms}ms`);
    if (status === "failed") await queueRetry(id, user.id, paths, "nothing recognised");
    return NextResponse.json({ status, fields, issued_on: r.issued_on, valid_until: r.valid_until, confidence: ocr.confidence });
  } catch (e) {
    await save("queued", {}, null, null, `server OCR failed: ${(e as Error).message}`);
    await queueRetry(id, user.id, paths, (e as Error).message);
    return NextResponse.json({ status: "queued", fields: {}, issued_on: null, valid_until: null, reason: (e as Error).message });
  }
}

async function queueRetry(documentId: string, userId: string, paths: string[], reason: string) {
  await adminClient().from("jobs").insert({ type: "ocr_document", user_id: userId, payload: { document_id: documentId, paths, reason } });
}
