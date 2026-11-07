import { describe, expect, it } from "vitest";
import { extractScholarship } from "@grantly/core";
import { fillMissing, ProviderError, type Provider } from "../src/llm";
import { memoryLlmStore } from "../src/store";

const PAGE = `# Example Grant 2027

## Eligibility
Annual family income should not exceed Rs 5 lakh.

## Important Dates
Applications close on 20 January 2027.
`;

const now = new Date("2026-11-07");
const providers: Provider[] = [
  { name: "gemini", model: "m", key: "k" },
  { name: "groq", model: "m", key: "k" },
  { name: "openrouter", model: "m", key: "k" },
];

const good = JSON.stringify({ amount: { min: 25000, max: 25000, cur: "INR", per: "year", e: "Award of Rs 25,000 per year" } });
const pageWithAmount = PAGE + "\n## Benefits\nSelected students get an award. Award of Rs 25,000 per year.\n";

function draftMissingAmount() {
  const d = extractScholarship({ text: PAGE, now });
  return { ...d, missing: ["amount" as const] };
}

describe("LLM fallback chain", () => {
  it("falls through rate limit and invalid output to a working provider", async () => {
    const store = memoryLlmStore();
    const calls: string[] = [];
    const res = await fillMissing(draftMissingAmount(), pageWithAmount, {
      providers,
      store,
      call: async (p) => {
        calls.push(p.name);
        if (p.name === "gemini") throw new ProviderError("rate_limited", "429");
        if (p.name === "groq") return { text: "sorry, I cannot", tokensIn: 10, tokensOut: 5 };
        return { text: good, tokensIn: 10, tokensOut: 5 };
      },
    });
    expect(calls).toEqual(["gemini", "groq", "openrouter"]);
    expect(res.draft.missing).toEqual([]);
    expect(res.draft.amount?.value.max).toBe(25000);
    expect(res.attempts.map((a) => a.outcome)).toEqual(["rate_limited", "invalid", "ok"]);
    expect(await store.cooldownUntil("gemini")).toBeGreaterThan(Date.now());
  });

  it("skips providers on cooldown and never throws when all fail", async () => {
    const store = memoryLlmStore();
    await store.setCooldown("gemini", Date.now() + 60000, "x");
    const res = await fillMissing(draftMissingAmount(), pageWithAmount, {
      providers,
      store,
      call: async () => {
        throw new ProviderError("timeout", "timed out");
      },
    });
    expect(res.attempts[0].outcome).toBe("skipped_cooldown");
    expect(res.draft.missing).toEqual(["amount"]);
  });

  it("rejects hallucinated values not present in the evidence", async () => {
    const res = await fillMissing(draftMissingAmount(), pageWithAmount, {
      providers: [providers[0]],
      store: memoryLlmStore(),
      call: async () => ({ text: JSON.stringify({ amount: { min: 900000, max: 900000, cur: "INR", per: "year", e: "Award of Rs 25,000 per year" } }), tokensIn: 1, tokensOut: 1 }),
    });
    expect(res.draft.missing).toEqual(["amount"]);
  });

  it("uses cache on the second run without calling providers", async () => {
    const store = memoryLlmStore();
    let n = 0;
    const call = async () => {
      n++;
      return { text: good, tokensIn: 1, tokensOut: 1 };
    };
    await fillMissing(draftMissingAmount(), pageWithAmount, { providers, store, call });
    const second = await fillMissing(draftMissingAmount(), pageWithAmount, { providers, store, call });
    expect(n).toBe(1);
    expect(second.skipped).toBe("cache hit");
    expect(second.draft.missing).toEqual([]);
  });

  it("does nothing when no fields are missing or no providers", async () => {
    const d = extractScholarship({ text: pageWithAmount, now });
    const r1 = await fillMissing({ ...d, missing: [] }, pageWithAmount, { providers, store: memoryLlmStore() });
    expect(r1.attempts).toEqual([]);
    const r2 = await fillMissing(draftMissingAmount(), pageWithAmount, { providers: [], store: memoryLlmStore() });
    expect(r2.skipped).toMatch(/No LLM/);
  });
});
