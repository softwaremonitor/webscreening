export interface ParsedKeyword {
  /** The original raw text as entered by the user, e.g. `"Bottle Collective"` or `Amcor`. */
  raw: string;
  /** The text to actually search for in the haystack. */
  search: string;
  /** True if the original was a quoted phrase. */
  isPhrase: boolean;
}

/**
 * Parse a single keyword. Strings wrapped in double quotes ("…" or "…")
 * are treated as exact phrases. Whitespace around the value is trimmed.
 */
export function parseKeyword(raw: string): ParsedKeyword {
  const trimmed = raw.trim();
  const m = trimmed.match(/^[“"”](.+)[“"”]$/);
  if (m) return { raw: trimmed, search: m[1].trim(), isPhrase: true };
  return { raw: trimmed, search: trimmed, isPhrase: false };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Given a haystack (title + excerpt + content concatenated) and a list of
 * keywords, return the raw keyword texts that match. Matching is
 * case-insensitive and word-bounded — `SIG` matches "SIG Combibloc" but
 * not "design". Quoted phrases use the same logic on the full expression.
 */
export function findMatches(haystack: string, keywords: ParsedKeyword[]): string[] {
  if (!haystack) return [];
  const hits: string[] = [];
  for (const kw of keywords) {
    const needle = kw.search;
    if (!needle) continue;
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegex(needle)}(?=$|[^\\p{L}\\p{N}])`, "iu");
    if (re.test(haystack)) hits.push(kw.raw);
  }
  return hits;
}

/** Build a single haystack string from an article's text fields. */
export function buildHaystack(parts: {
  title?: string | null;
  excerpt?: string | null;
  content?: string | null;
}): string {
  return [parts.title, parts.excerpt, parts.content]
    .filter((v): v is string => Boolean(v && v.length))
    .join("\n");
}
