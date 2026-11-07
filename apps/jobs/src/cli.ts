import { readFile } from "node:fs/promises";
import { normalizeUrl } from "@grantly/core";
import { db } from "./db";

const file = process.argv[2];
if (!file) {
  console.log("Usage: pnpm --filter worker seed-run sources.csv\nCSV columns: url,provider,tier,kind");
  process.exit(1);
}

const rows = (await readFile(file, "utf8"))
  .split("\n")
  .slice(1)
  .map((l) => l.split(",").map((x) => x.trim()))
  .filter((r) => r[0]);

let n = 0;
for (const [rawUrl, provider, tier, kind] of rows) {
  const url = normalizeUrl(rawUrl);
  if (!url) continue;
  const { data: src } = await db
    .from("sources")
    .upsert({ url, provider: provider || null, tier: tier || "B", kind: kind || (url.endsWith(".pdf") ? "pdf" : "detail"), active: true }, { onConflict: "url" })
    .select("id")
    .single();
  if (src) {
    await db.from("jobs").insert({ type: "ingest_source", payload: { source_id: src.id, use_llm: true } });
    n++;
  }
}
console.log(`Queued ${n} sources. Start the worker and review drafts at /admin.`);
