import { Readability } from "@mozilla/readability";
import { stripHidden } from "@grantly/core";
import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import { JSDOM, VirtualConsole } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
td.use(gfm);
td.remove(["script", "style", "noscript", "iframe", "form", "button", "nav", "footer"] as never);

export interface Cleaned {
  title: string | null;
  text: string;
  links: { href: string; text: string }[];
  hash: string;
}

export function htmlToText(html: string, url: string): Cleaned {
  const safe = stripHidden(html);
  const $ = cheerio.load(safe);
  const links = $("a[href]")
    .map((_, a) => ({ href: new URL($(a).attr("href")!, url).toString(), text: $(a).text().trim() }))
    .get()
    .filter((l) => l.href.startsWith("http"));

  let title: string | null = $("h1").first().text().trim() || $("title").text().trim() || null;
  let body: string;
  try {
    const vc = new VirtualConsole();
    const dom = new JSDOM(safe, { url, virtualConsole: vc });
    const art = new Readability(dom.window.document, { keepClasses: false }).parse();
    body = art?.content ? td.turndown(art.content) : td.turndown($("main").html() ?? $("body").html() ?? "");
    if (art?.title && !title) title = art.title;
  } catch {
    body = td.turndown($("main").html() ?? $("body").html() ?? "");
  }
  const text = tidy(body);
  return { title, text, links, hash: hashText(text) };
}

export function tidy(s: string) {
  return s
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
}

export function hashText(text: string) {
  const norm = text.toLowerCase().replace(/\s+/g, " ").replace(/\b(updated|last modified|visitors?|hits?)\b[^.\n]{0,40}/g, "");
  return createHash("sha256").update(norm).digest("hex");
}
