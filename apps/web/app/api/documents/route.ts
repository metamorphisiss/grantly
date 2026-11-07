import { NextResponse } from "next/server";
import { DOC_TYPES } from "@grantly/core";
import { getUser, userClient } from "@/lib/supabase";

const EXT = /^(pdf|jpg|jpeg|png|webp|heic|heif)$/;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!DOC_TYPES[b.doc_type]) return NextResponse.json({ error: "Unknown document type" }, { status: 400 });
  const ext = String(b.ext ?? "").toLowerCase();
  if (!EXT.test(ext)) return NextResponse.json({ error: "Use a PDF, JPG, PNG, WEBP or HEIC file." }, { status: 400 });
  const id = crypto.randomUUID();
  const storage_path = `${user.id}/${id}/original.${ext}`;
  const db = await userClient();
  const { error } = await db.from("documents").insert({ id, user_id: user.id, doc_type: b.doc_type, storage_path, file_name: String(b.file_name ?? "").slice(0, 200) });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id, path: storage_path, folder: `${user.id}/${id}` });
}
