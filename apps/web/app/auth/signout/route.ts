import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase";

export async function POST(req: Request) {
  const db = await userClient();
  await db.auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
