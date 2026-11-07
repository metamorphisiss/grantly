import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postgres from "postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env.db");
if (!process.env.SUPABASE_DB_URL && existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*SUPABASE_DB_URL\s*=\s*(.+)\s*$/);
    if (m) process.env.SUPABASE_DB_URL = m[1].replace(/^["']|["']$/g, "");
  }
}
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Set SUPABASE_DB_URL (Supabase → Connect → Session pooler connection string) in a .env.db file at the repo root.\nOr skip this script and paste supabase/setup.sql into the Supabase SQL Editor instead.");
  process.exit(1);
}
const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });
try {
  const [{ exists }] = await sql`select to_regclass('public.scholarships') is not null as exists`;
  if (!exists) {
    console.log("Creating tables, policies and storage bucket…");
    await sql.unsafe(readFileSync(path.join(root, "supabase/migrations/20261107000000_init.sql"), "utf8"));
  } else {
    console.log("Tables already exist, skipping schema.");
  }
  console.log("Loading scholarship data…");
  await sql.unsafe(readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));
  const [{ n }] = await sql`select count(*)::int as n from public.scholarships`;
  console.log(`Done. ${n} scholarships in the database.`);
} catch (e) {
  console.error("Setup failed:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
