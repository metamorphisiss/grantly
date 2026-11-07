import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { extractText, getDocumentProxy } from "unpdf";
import { env } from "./env";

const run = promisify(execFile);

async function withTmp<T>(fn: (dir: string) => Promise<T>) {
  const dir = await mkdtemp(join(tmpdir(), "grantly-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function ocrImage(buf: Buffer, ext: string): Promise<string> {
  return withTmp(async (dir) => {
    let input = buf;
    let e = ext.toLowerCase();
    if (e === "heic" || e === "heif") {
      const convert = (await import("heic-convert")).default as (o: { buffer: Buffer; format: string; quality: number }) => Promise<ArrayBuffer>;
      input = Buffer.from(await convert({ buffer: buf, format: "JPEG", quality: 0.9 }));
      e = "jpg";
    }
    const p = join(dir, `in.${e}`);
    await writeFile(p, input);
    const { stdout } = await run("tesseract", [p, "stdout", "-l", env.ocrLangs, "--psm", "3"], { maxBuffer: 20 * 1024 * 1024, timeout: 90000 });
    return stdout;
  });
}

export async function decryptPdf(buf: Buffer, password: string): Promise<Buffer> {
  return withTmp(async (dir) => {
    const i = join(dir, "in.pdf");
    const o = join(dir, "out.pdf");
    await writeFile(i, buf);
    await run("qpdf", [`--password=${password}`, "--decrypt", i, o], { timeout: 30000 });
    return readFile(o);
  });
}

export async function pdfToText(buf: Buffer, opts: { maxOcrPages?: number } = {}): Promise<{ text: string; ocr: boolean }> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    const t = (Array.isArray(text) ? text.join("\n") : text).trim();
    if (t.replace(/\s/g, "").length > 200) return { text: t, ocr: false };
  } catch (e) {
    if (/password/i.test(String(e))) throw new Error("PDF is password protected");
  }
  return withTmp(async (dir) => {
    const p = join(dir, "in.pdf");
    await writeFile(p, buf);
    await run("pdftoppm", ["-r", "200", "-png", "-l", String(opts.maxOcrPages ?? 6), p, join(dir, "pg")], { timeout: 120000 });
    const pages = (await readdir(dir)).filter((f) => f.startsWith("pg") && f.endsWith(".png")).sort();
    const out: string[] = [];
    for (const pg of pages) {
      const { stdout } = await run("tesseract", [join(dir, pg), "stdout", "-l", env.ocrLangs], { maxBuffer: 20 * 1024 * 1024, timeout: 90000 });
      out.push(stdout);
    }
    return { text: out.join("\n"), ocr: true };
  });
}
