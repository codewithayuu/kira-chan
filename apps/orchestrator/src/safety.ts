const PII_EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PII_PHONE = /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{4}\b/g;
const CARD = /\b(?:\d[ -]*?){13,16}\b/g;

const NSFW_HINTS = /(porn|nude|cum|blowjob|69|hentai|sex\s*act|xxx)/i;

export function redactPII(s: string) {
  return s.replace(PII_EMAIL, "[email]").replace(PII_PHONE, "[phone]").replace(CARD, "[card]");
}

export function isLikelyNSFW(s: string) {
  return NSFW_HINTS.test(s);
}

let cls: any = null;
export async function isToxic(text: string) {
  try {
    if (!cls) {
      const { pipeline } = await import("@xenova/transformers");
      cls = await pipeline("text-classification", "Xenova/toxic-bert");
    }
    const out: any = await cls(text);
    const arr = Array.isArray(out) ? out : [out];
    return arr.some((o: any) => /toxic/i.test(o.label) && o.score > 0.5);
  } catch {
    return false;
  }
}


