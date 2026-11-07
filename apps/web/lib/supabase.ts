import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export async function userClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(url(), publishable(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {}
      },
    },
  });
}

export function anonClient(): SupabaseClient {
  return createClient(url(), publishable(), { auth: { persistSession: false } });
}

let admin: SupabaseClient | null = null;
export function adminClient(): SupabaseClient {
  if (!admin) admin = createClient(url(), process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

export const getUser = cache(async () => {
  const db = await userClient();
  const { data } = await db.auth.getUser();
  return data.user ?? null;
});
