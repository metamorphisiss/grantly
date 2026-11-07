"use client";

type PdfJs = typeof import("pdfjs-dist");
let lib: Promise<PdfJs> | null = null;

async function pdfjs() {
  if (!lib) {
    lib = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return m;
    });
  }
  return lib;
}

export class NeedsPassword extends Error {}

export async function readPdf(file: File, password?: string, maxPages = 3) {
  const m = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  let doc;
  try {
    doc = await m.getDocument({ data, password }).promise;
  } catch (e) {
    if ((e as { name?: string }).name === "PasswordException") throw new NeedsPassword();
    throw e;
  }
  const n = Math.min(doc.numPages, maxPages);
  let text = "";
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const c = await page.getTextContent();
    text += c.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return {
    text,
    pages: n,
    async renderImages(maxSide = 1800): Promise<Blob[]> {
      const out: Blob[] = [];
      for (let i = 1; i <= n; i++) {
        const page = await doc.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(2.5, maxSide / Math.max(base.width, base.height));
        const vp = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
        out.push(await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("render failed"))), "image/png")));
      }
      return out;
    },
  };
}

export async function downscaleImage(file: Blob, maxSide = 2000): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 3_000_000) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("resize failed"))), "image/jpeg", 0.88));
}

export async function heicToJpeg(file: File): Promise<Blob> {
  const heic2any = (await import("heic2any")).default;
  const r = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  return Array.isArray(r) ? r[0] : r;
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
