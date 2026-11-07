import { NextResponse } from "next/server";
import { adminClient, getUser, userClient } from "@/lib/supabase";

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const admin = adminClient();
  const { data: files } = await admin.from("documents").select("storage_path").eq("user_id", user.id);
  const { data: listed } = await admin.storage.from("documents").list(user.id, { limit: 1000 });
  const paths = [...new Set([...(files ?? []).map((f) => f.storage_path), ...(listed ?? []).map((f) => `${user.id}/${f.name}`)])];
  if (paths.length) await admin.storage.from("documents").remove(paths);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const db = await userClient();
  await db.auth.signOut();
  return NextResponse.json({ ok: true });
}
