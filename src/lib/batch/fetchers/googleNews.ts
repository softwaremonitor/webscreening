import Parser from "rss-parser";
import { httpGet } from "@/lib/batch/http";
import { politely } from "@/lib/batch/rateLimit";
import { logger } from "@/lib/logger";
import { stripHtml } from "@/lib/text";
import type { ArticleCandidate, FetcherResult } from "@/lib/batch/types";

const parser: Parser<unknown, Record<string, unknown>> = new Parser({
  timeout: 20000,
});

// Per-language locale parameters for Google News. Keys are the 2-letter ISO
// codes already used by Source.defaultLanguage in the seed.
const LOCALES: Record<string, { hl: string; gl: string; ceid: string }> = {
  fr: { hl: "fr", gl: "FR", ceid: "FR:fr" },
  en: { hl: "en-US", gl: "US", ceid: "US:en" },
  de: { hl: "de", gl: "DE", ceid: "DE:de" },
  it: { hl: "it", gl: "IT", ceid: "IT:it" },
  es: { hl: "es", gl: "ES", ceid: "ES:es" },
  nl: { hl: "nl", gl: "NL", ceid: "NL:nl" },
  pt: { hl: "pt-PT", gl: "PT", ceid: "PT:pt-150" },
};

/** Strip "www." prefix; keep everything else (so subdomains stay). */
function bareHost(homepageUrl: string): string | null {
  try {
    return new URL(homepageUrl).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

/**
 * Google News appends " - Source Name" to each item title. Best-effort strip:
 * only remove the trailing segment if it looks like a source name (≤ 60 chars,
 * no sentence punctuation).
 */
function cleanTitle(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const t = raw.trim();
  const m = t.match(/^(.*?) - ([^-]{1,60})$/);
  if (m && !/[.!?]$/.test(m[2])) return m[1].trim();
  return t;
}

/**
 * Fetch packaging news mentioning a given site via Google News RSS.
 * Used as last-resort fallback when the site itself blocks our crawler.
 *
 * Trade-offs vs. native feeds:
 *   - covers any public web source (no auth needed)
 *   - article links go through a Google redirect (the user's browser follows)
 *   - latency: Google indexes within minutes-to-hours, not real-time
 *   - coverage: only what Google deems newsworthy for the domain
 */
export async function fetchFromGoogleNews(
  homepageUrl: string,
  defaultLanguage?: string | null
): Promise<FetcherResult> {
  const host = bareHost(homepageUrl);
  if (!host) return { candidates: [], origin: homepageUrl };
  const loc = LOCALES[(defaultLanguage ?? "en").toLowerCase()] ?? LOCALES.en;
  const q = encodeURIComponent(`site:${host}`);
  const feedUrl =
    `https://news.google.com/rss/search?q=${q}` +
    `&hl=${loc.hl}&gl=${loc.gl}&ceid=${loc.ceid}`;

  const res = await politely(feedUrl, () => httpGet(feedUrl));
  if (!res.ok || !res.body) {
    logger.warn(
      { feedUrl, status: res.status },
      "google news fetch failed"
    );
    return { candidates: [], origin: feedUrl };
  }
  let feed;
  try {
    feed = await parser.parseString(res.body);
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, feedUrl },
      "google news RSS parse failed"
    );
    return { candidates: [], origin: feedUrl };
  }

  const candidates: ArticleCandidate[] = [];
  for (const item of feed.items ?? []) {
    if (!item.link) continue;
    const pubRaw =
      (item.isoDate as string | undefined) ??
      (item.pubDate as string | undefined);
    const publishedAt = pubRaw ? new Date(pubRaw) : undefined;
    const excerpt = stripHtml(
      (item.contentSnippet as string | undefined) ??
        (item.content as string | undefined) ??
        ""
    );
    candidates.push({
      url: item.link, // Google redirect URL; resolves in the browser
      title: cleanTitle(item.title),
      excerpt: excerpt || undefined,
      publishedAt:
        publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : undefined,
      language: defaultLanguage ?? undefined,
    });
  }
  return { candidates, origin: feedUrl };
}
