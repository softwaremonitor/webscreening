import { load } from "cheerio";
import { httpGet } from "@/lib/batch/http";
import { politely } from "@/lib/batch/rateLimit";
import { isAllowed } from "@/lib/batch/robots";
import { resolveUrl } from "@/lib/url";
import { logger } from "@/lib/logger";
import type { ArticleCandidate, FetcherResult } from "@/lib/batch/types";

const SKIP_PATH_PATTERNS = [
  /\/tag\//i,
  /\/tags\//i,
  /\/category\//i,
  /\/categories\//i,
  /\/author\//i,
  /\/page\//i,
  /\/contact/i,
  /\/about/i,
  /\/privacy/i,
  /\/terms/i,
  /\/jobs?/i,
  /\/newsletter/i,
  /\/subscribe/i,
  /\.pdf$/i,
  /\.jpg$/i,
  /\.png$/i,
];

function looksLikeArticleUrl(href: string, baseHost: string): boolean {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return false;
  }
  if (u.hostname !== baseHost) return false;
  if (SKIP_PATH_PATTERNS.some((re) => re.test(u.pathname))) return false;
  const segments = u.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return false;
  const last = segments[segments.length - 1];
  // Heuristic: article slugs usually contain a hyphen and at least 3 words.
  return last.includes("-") && last.split("-").length >= 3;
}

/**
 * Crawl the homepage of a source, extract probable article links.
 * This is a fallback when no feed/sitemap is available. Publication dates
 * are unknown at this point — they will be filled in by the per-page extractor.
 */
export async function fetchFromHtml(homepageUrl: string): Promise<FetcherResult> {
  if (!(await isAllowed(homepageUrl))) {
    logger.info({ homepageUrl }, "robots.txt disallows homepage");
    return { candidates: [], origin: homepageUrl };
  }
  const res = await politely(homepageUrl, () => httpGet(homepageUrl));
  if (!res.ok || !res.body) {
    throw new Error(`HTML fetch failed: ${res.status} ${homepageUrl}`);
  }
  const $ = load(res.body);
  const baseHost = new URL(homepageUrl).hostname;
  const seen = new Set<string>();
  const candidates: ArticleCandidate[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const resolved = resolveUrl(href, homepageUrl);
    if (!resolved) return;
    if (seen.has(resolved)) return;
    if (!looksLikeArticleUrl(resolved, baseHost)) return;
    seen.add(resolved);
    const title = $(el).text().trim();
    candidates.push({
      url: resolved,
      title: title.length > 5 && title.length < 200 ? title : undefined,
    });
  });

  return { candidates, origin: homepageUrl };
}
