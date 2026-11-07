import type { SupabaseClient } from "@supabase/supabase-js";
import type { LlmStore, ProviderName } from "./llm";

const today = () => new Date().toISOString().slice(0, 10);

export function supabaseLlmStore(db: SupabaseClient): LlmStore {
  return {
    async getCache(key) {
      const { data } = await db.from("llm_cache").select("response").eq("key", key).maybeSingle();
      return data?.response ?? null;
    },
    async setCache(key, provider, value) {
      await db.from("llm_cache").upsert({ key, model: provider, response: value });
    },
    async tokensToday(provider: ProviderName) {
      const { data } = await db.from("llm_usage").select("tokens_in, tokens_out").eq("day", today()).eq("provider", provider).maybeSingle();
      return data ? data.tokens_in + data.tokens_out : 0;
    },
    async addUsage(provider, tokensIn, tokensOut, ok) {
      await db.rpc("add_llm_usage", { p_provider: provider, p_in: tokensIn, p_out: tokensOut, p_ok: ok });
    },
    async cooldownUntil(provider) {
      const { data } = await db.from("llm_provider_state").select("cooldown_until").eq("provider", provider).maybeSingle();
      return data?.cooldown_until ? new Date(data.cooldown_until).getTime() : 0;
    },
    async setCooldown(provider, untilMs, error) {
      await db.from("llm_provider_state").upsert({ provider, cooldown_until: new Date(untilMs).toISOString(), last_error: error.slice(0, 300), updated_at: new Date().toISOString() });
    },
  };
}

export function memoryLlmStore(): LlmStore & { cache: Map<string, unknown> } {
  const cache = new Map<string, unknown>();
  const usage = new Map<string, number>();
  const cool = new Map<string, number>();
  return {
    cache,
    async getCache(k) {
      return cache.get(k) ?? null;
    },
    async setCache(k, _p, v) {
      cache.set(k, v);
    },
    async tokensToday(p) {
      return usage.get(p) ?? 0;
    },
    async addUsage(p, i, o) {
      usage.set(p, (usage.get(p) ?? 0) + i + o);
    },
    async cooldownUntil(p) {
      return cool.get(p) ?? 0;
    },
    async setCooldown(p, u) {
      cool.set(p, u);
    },
  };
}
