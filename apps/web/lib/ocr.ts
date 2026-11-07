import "server-only";
import path from "node:path";
import { existsSync } from "node:fs";
import { createWorker, type Worker } from "tesseract.js";

function langPath() {
  const candidates = [path.join(process.cwd(), "ocr-data"), path.join(process.cwd(), "apps/web/ocr-data")];
  return candidates.find((p) => existsSync(path.join(p, "eng.traineddata.gz"))) ?? candidates[0];
}

const workers = new Map<string, Promise<Worker>>();

function getWorker(langs: string) {
  if (!workers.has(langs)) {
    workers.set(
      langs,
      createWorker(langs, 1, { langPath: langPath(), cachePath: "/tmp/tess", gzip: true, logger: () => {} }).catch((e) => {
        workers.delete(langs);
        throw e;
      }),
    );
  }
  return workers.get(langs)!;
}

export async function ocrImages(images: Buffer[], opts: { deadlineMs: number }) {
  const started = Date.now();
  const texts: string[] = [];
  let confSum = 0;
  let langs = "eng";
  for (const img of images) {
    if (Date.now() - started > opts.deadlineMs) break;
    const w = await getWorker(langs);
    const r = await w.recognize(img);
    texts.push(r.data.text);
    confSum += r.data.confidence;
  }
  let confidence = texts.length ? confSum / texts.length : 0;
  if (confidence < 60 && Date.now() - started < opts.deadlineMs / 2 && images[0]) {
    langs = "eng+hin+mar";
    const w = await getWorker(langs);
    const r = await w.recognize(images[0]);
    if (r.data.confidence > confidence) {
      texts[0] = r.data.text;
      confidence = r.data.confidence;
    }
  }
  return { text: texts.join("\n"), confidence, pages: texts.length, ms: Date.now() - started, langs };
}

export async function ocrSelfTest() {
  const tiny = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAANwAAAAwCAAAAABft0ukAAAD0ElEQVR42u2ZbWyTVRTHf7dQRs2WAZtzMNwGOkBAEGXoByMyUIMQZ6IjDhcXEttoxGRCdGKnaGBmREUJRDHZcBGn4HyBGYkBSWuCugwSNLwNpwhzGYsWQUa2MbddPzxP+9yng9p+aNPovV96zz3/POf8npdzz02F5L87HGg4DafhNJyG03AaTsNpOA2n4WKFG9r91JzxKWl5S6vbzBW/EEII4Zpw36a/FOERIURjyPILIRYFjfVCHCIgwscP+IWoMiSLhcNnXSpFFA7Eh06qo2mK5Sg6KKWU0kqCnGZL+TRwb8jyAXxlGuvgoPxjWKDD0gdeQ9I5jtwLprx/Nq4TMi7DBveiwLni8/aeiyfeuRvygnl7pZSBA0sgIxBU9o0jC8cZG9wtQwpccMwgXb0FJpzcCY+Z0xdgk4w/3Ba46WTQ2D89LyyjMngl6G2Ar0ezVkm7ALZHDyeXw6dSSimbR7BwKP5wp51knbXM7oqwjA7DnUHnAm6Ty8kdtNJ+PZf8y9HDnZ9IZpeUsmcq6e1xYpNKQan5m1ezLTP1zbCPZgb8Zk5P+fHgoX2f5U1Zx+m3o//Ux7wnAm7g+ZNsuT7+1VJ+Qtqj/6IeYf7WydRS5k+hVvGVzWL9xegDL1rJF7X4NvNQWQK2giMB5o2OJD0K+cZssJ5H0sBNU0C5Ug3nNsQQecNUVv24QmZvTcQ+9ytMiyh9DUqM2Z5O3ED5qP73Ff/iBbzVGX1k1wcju+84Q21mIuDOwRhzOs3YdtV72neo9CPmlBtGLbPmAdcWU2d7FqLn5RhCz62iD/eShHQoEsSVNdVCCFfhDkfJPhcAXXvwAODh+PeKrrCEba0xxPZOxLUxMe1XJpw3p61SysZh0hsrMoxJ/YDLqDwLJ9tKCtXOwTUxxB6ZzqjUxMBNgqvcdq+UAx31k34q2mvY2+gdK4QQwnGKjy+p+B52fZeUjfPNGbT0XXUPyCn/dsLl0rMA/jbFcWmHKnspjcqkhBMldH8YQTn+Xf581ignM0M9wDJ7SclazYGmpDzyVDrx/h5BuvQeGlrgwmcUh9YepPmYqll9HWsGkxEufyNdRb8ErSukWCN4Dhp6Fbj7nfaSkrqW4w1JeVhdWcWx6Y83dfT2d+2vcA/fGW5dxjdfUkfO3NBS+ny296sadwFtyfNe2tro3QWWI/uN3vBW/mcnM1vgSfsxaaeUPthsLjRChFOB0u+EOeN8KgAeaN31xOws5zU5dz2zt2PVsE7zBjdHK1HeSijG/l7y8O3J8+CE/mdVw2k4DafhNJyG03AaTsNpuP853D/ZBSYdt64NOgAAAABJRU5ErkJggg==",
    "base64",
  );
  const t0 = Date.now();
  const w = await getWorker("eng");
  const r = await w.recognize(tiny);
  const ok = /GRANTLY/i.test(r.data.text);
  return { ok, ms: Date.now() - t0, langPath: langPath(), read: r.data.text.trim() };
}
