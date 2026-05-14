const TRACKING_PARAM_PATTERNS: RegExp[] = [
  /^utm_/i,
  /^icid$/i,
  /^cmpid$/i,
  /^mc_/i,
  /^ga_/i,
  /^_ga$/i,
  /^_gl$/i,
  /^gclid$/i,
  /^fbclid$/i,
  /^msclkid$/i,
  /^yclid$/i,
  /^dclid$/i,
  /^mkt_tok$/i,
  /^hsCtaTracking$/i,
  /^hsa_/i,
  /^vero_/i,
  /^trk$/i,
  /^trkCampaign$/i,
  /^ref$/i,
  /^ref_src$/i,
  /^ref_url$/i,
  /^source$/i,
  /^cmp$/i,
  /^campaign$/i,
  /^spm$/i,
  /^scm$/i,
  /^pk_/i,
  /^piwik_/i,
  /^matomo_/i,
];

function isTrackingParam(name: string): boolean {
  return TRACKING_PARAM_PATTERNS.some((re) => re.test(name));
}

/**
 * Normalize a URL for deduplication:
 *  - lowercase scheme and host
 *  - strip default ports, fragments, common tracking params
 *  - strip a single trailing slash on the path (but keep "/")
 */
export function normalizeUrl(input: string): string {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return input.trim();
  }

  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();
  u.hash = "";

  if (
    (u.protocol === "http:" && u.port === "80") ||
    (u.protocol === "https:" && u.port === "443")
  ) {
    u.port = "";
  }

  const params = Array.from(u.searchParams.entries());
  u.search = "";
  const keep = params
    .filter(([k]) => !isTrackingParam(k))
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [k, v] of keep) u.searchParams.append(k, v);

  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }

  return u.toString();
}

/** Return the registrable hostname (used for per-host rate limiting). */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Resolve a possibly-relative href against a base URL. */
export function resolveUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}
