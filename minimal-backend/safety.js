const PII_EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PII_PHONE = /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{4}\b/g;
const CARD = /\b(?:\d[ -]*?){13,16}\b/g;

const NSFW_HINTS = /(porn|nude|cum|blowjob|69|hentai|sex\s*act|xxx)/i;

function redactPII(s) {
  if (!s || typeof s !== 'string') return s;
  return s.replace(PII_EMAIL, '[email]').replace(PII_PHONE, '[phone]').replace(CARD, '[card]');
}

function isLikelyNSFW(s) {
  if (!s || typeof s !== 'string') return false;
  return NSFW_HINTS.test(s);
}

module.exports = { redactPII, isLikelyNSFW };


