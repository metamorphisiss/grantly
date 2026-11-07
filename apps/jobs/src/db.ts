import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

export const db = createClient(env.supabaseUrl, env.supabaseKey, { auth: { persistSession: false } });

export type Job = {
  id: string;
  type: "ingest_source" | "ingest_url" | "ocr_document" | "recheck_source" | "send_reminders";
  payload: Record<string, unknown>;
  user_id: string | null;
  attempts: number;
};
