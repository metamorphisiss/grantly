import { lookup } from "node:dns/promises";
import { isPrivateIp } from "@grantly/core";
import robotsParser from "robots-parser";

export const UA = `GrantlyBot/1.0 (+${process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://github.com"})`;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT = 20000;

export class FetchError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

async function assertPublic(u: URL) {
  if (!["http:", "https:"].includes(u.protocol)) throw new FetchError("Only http and https links are allowed");
  if (u.username || u.password) throw new FetchError("Links with credentials are not allowed");
  if (u.port && !["80", "443", ""].includes(u.port)) throw new FetchError("Unusual port");
  const addrs = await lookup(u.hostname, { all: true }).catch(() => []);
  if (!addrs.length) throw new FetchError("Site not found");
  if (addrs.some((a) => isPrivateIp(a.address))) throw new FetchError("Blocked address");
}

const robotsCache = new Map<string, ReturnType<typeof robotsParser> | null>();

async function allowedByRobots(u: URL) {
  const key = u.origin;
  if (!robotsCache.has(key)) {
    try {
      const r = await rawGet(new URL("/robots.txt", u), 0);
      robotsCache.set(key, r.status === 200 ? robotsParser(`${key}/robots.txt`, r.body.toString("utf8")) : null);
    } catch {
      robotsCache.set(key, null);
    }
  }
  const rp = robotsCache.get(key);
  return rp ? rp.isAllowed(u.toString(), "GrantlyBot") !== false : true;
}

async function rawGet(u: URL, depth: number): Promise<{ status: number; body: Buffer; contentType: string; finalUrl: string }> {
  await assertPublic(u);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(u, { redirect: "manual", signal: ctl.signal, headers: { "user-agent": UA, accept: "text/html,application/pdf;q=0.9,*/*;q=0.5" } });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc || depth >= MAX_REDIRECTS) throw new FetchError("Too many redirects");
      return rawGet(new URL(loc, u), depth + 1);
    }
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) throw new FetchError("Page is too large");
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) {
          ctl.abort();
          throw new FetchError("Page is too large");
        }
        chunks.push(value);
      }
    }
    return { status: res.status, body: Buffer.concat(chunks), contentType: res.headers.get("content-type") ?? "", finalUrl: u.toString() };
  } catch (e) {
    if (e instanceof FetchError) throw e;
    throw new FetchError((e as Error).name === "AbortError" ? "Timed out" : "Could not reach the site");
  } finally {
    clearTimeout(t);
  }
}

export async function safeGet(url: string) {
  const u = new URL(url);
  if (!(await allowedByRobots(u))) throw new FetchError("Site does not allow automated reading");
  const r = await rawGet(u, 0);
  if (r.status === 401 || r.status === 403) throw new FetchError("Page needs a login");
  if (r.status === 404 || r.status === 410) throw new FetchError("Page not found");
  if (r.status >= 400) throw new FetchError(`Site returned ${r.status}`);
  return r;
}

export { assertPublic };
