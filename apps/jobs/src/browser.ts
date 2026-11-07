import { assertPublic, UA } from "@grantly/pipeline";

export async function renderWithBrowser(url: string): Promise<string | null> {
  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return null;
  }
  const browser = await chromium.launch().catch(() => null);
  if (!browser) return null;
  try {
    const page = await browser.newPage({ userAgent: UA });
    await page.route("**/*", async (route) => {
      try {
        await assertPublic(new URL(route.request().url()));
        if (["image", "media", "font"].includes(route.request().resourceType())) return route.abort();
        return route.continue();
      } catch {
        return route.abort();
      }
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    return await page.content();
  } catch {
    return null;
  } finally {
    await browser.close().catch(() => {});
  }
}
