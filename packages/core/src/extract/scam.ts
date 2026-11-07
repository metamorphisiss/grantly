import { findMoney } from "./fields";

export interface TrustReport {
  level: "trusted" | "unknown" | "warning";
  positives: string[];
  flags: string[];
}

const TRUSTED_SUFFIXES = [".gov.in", ".nic.in", ".ac.in", ".edu.in", ".edu", ".gov", ".ac.uk", ".gov.uk", ".res.in"];

export function trustReport(url: string, text: string, knownProviderDomains: string[] = []): TrustReport {
  const positives: string[] = [];
  const flags: string[] = [];
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    flags.push("Invalid link");
  }
  if (TRUSTED_SUFFIXES.some((s) => host.endsWith(s))) positives.push("Official government or academic domain");
  if (knownProviderDomains.some((d) => host === d || host.endsWith("." + d))) positives.push("Known scholarship provider");
  if (url.startsWith("http://")) flags.push("Page is not served over HTTPS");

  const l = text.toLowerCase();
  if (/(registration|processing|application|verification|security)\s+(fee|charge|deposit)/.test(l) && !/no (registration|application) fee|free of cost/.test(l)) flags.push("Asks for a fee to apply");
  if (/\botp\b|one[- ]time password/.test(l)) flags.push("Mentions sharing an OTP");
  if (/(card number|cvv|upi pin|net ?banking password|atm pin)/.test(l)) flags.push("Asks for card or banking credentials");
  if (/(whatsapp|telegram)/.test(l) && !/@|\bemail\b/.test(l)) flags.push("Contact only through WhatsApp or Telegram");
  if (/(guaranteed|100% selection|everyone selected|no eligibility)/.test(l)) flags.push("Promises guaranteed selection");
  const maxInr = Math.max(0, ...findMoney(text).filter((m) => m.currency === "INR").map((m) => m.amount));
  if (maxInr > 5e7) flags.push("Unusually large amount");

  const level = flags.length ? "warning" : positives.length ? "trusted" : "unknown";
  return { level, positives, flags };
}
