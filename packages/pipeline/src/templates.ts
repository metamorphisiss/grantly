import * as cheerio from "cheerio";

export interface TemplateOut {
  title?: string;
  provider?: string;
  sections: Partial<Record<"eligibility" | "benefits" | "documents" | "dates" | "apply", string>>;
}

type Template = (html: string) => TemplateOut | null;

function sectionsByHeading($: cheerio.CheerioAPI, map: Record<string, RegExp>): TemplateOut["sections"] {
  const out: TemplateOut["sections"] = {};
  $("h2, h3, h4, strong").each((_, el) => {
    const h = $(el).text().trim();
    for (const [k, re] of Object.entries(map)) {
      if (re.test(h) && !out[k as keyof TemplateOut["sections"]]) {
        const parts: string[] = [];
        let n = $(el).closest("h2, h3, h4, p").next();
        while (n.length && !n.is("h2, h3, h4")) {
          parts.push(n.is("ul, ol") ? n.find("li").map((_, li) => `- ${$(li).text().trim()}`).get().join("\n") : n.text().trim());
          n = n.next();
        }
        out[k as keyof TemplateOut["sections"]] = parts.filter(Boolean).join("\n");
      }
    }
  });
  return out;
}

const generic: Template = (html) => {
  const $ = cheerio.load(html);
  const sections = sectionsByHeading($, {
    eligibility: /eligib|who can apply/i,
    benefits: /benefit|amount|award|stipend/i,
    documents: /document/i,
    dates: /date|deadline|timeline/i,
    apply: /how to apply|application process/i,
  });
  if (!sections.eligibility && !sections.benefits) return null;
  return { title: $("h1").first().text().trim() || undefined, sections };
};

const REGISTRY: Record<string, Template> = {
  "example.org": generic,
};

export function runTemplate(host: string, name: string | null, html: string): TemplateOut | null {
  const t = (name && REGISTRY[name]) || REGISTRY[host.replace(/^www\./, "")];
  if (!t) return null;
  try {
    return t(html);
  } catch {
    return null;
  }
}

export function templateToText(t: TemplateOut) {
  const heads: Record<string, string> = { eligibility: "Eligibility", benefits: "Benefits", documents: "Documents Required", dates: "Important Dates", apply: "How to Apply" };
  return Object.entries(t.sections)
    .filter(([, v]) => v)
    .map(([k, v]) => `## ${heads[k]}\n${v}`)
    .join("\n\n");
}
