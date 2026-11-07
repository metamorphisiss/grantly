import "server-only";
import { getUser, userClient } from "./supabase";

export async function assertAdmin() {
  const user = await getUser();
  if (!user) throw new Error("forbidden");
  const db = await userClient();
  const { data } = await db.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!data?.is_admin) throw new Error("forbidden");
  return user.id;
}
