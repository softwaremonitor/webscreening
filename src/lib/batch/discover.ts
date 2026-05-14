import { load } from "cheerio";
import { httpGet } from "@/lib/batch/http";
import { politely } from "@/lib/batch/rateLimit";
import { isAllowed } from "@/lib/batch/robots";
import { resolveUrl } from "@/lib/url";
import { logger } from "@/lib/logger";

const COMMON_FEED_PATHS = [
  "/feed",
  "/feed/",
  "/rss",
  "/rss.xml",
  "/atom.xml",
  "/index.xml",
  "/feeds/posts/default",
  "/?feed=rss2",
];

function looksLikeFeed(contentType: string, body: string): boolean {
  if (/(rss|atom|xml)/i.test(contentType)) return true;
  return /<rss\b|<feed\b/.test(body.slice(0, 4000));
}

/** Best-effort RSS/Atom feed discovery for a homepage URL. */
export async function discoverFeedUrl(
  homepageUrl: string
): Promise<string | null> {
  if (!(await isAllowed(homepageUrl))) return null;
  let homeRes;
  try {
    homeRes = await politely(homepageUrl, () => httpGet(homepageUrl));
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, homepageUrl },
      "discover: homepage fetch failed"
    );
    return null;
  }
  if (homeRes.ok && homeRes.body) {
    const $ = load(homeRes.body);
    const links = $(
      'link[rel="alternate"][type="application/rss+xml"], link[rel="alternate"][type="application/atom+xml"]'
    );
    for (const el of links.toArray()) {
      const href = $(el).attr("href");
      if (!href) continue;
      const resolved = resolveUrl(href, homepageUrl);
      if (resolved) return resolved;
    }
  }
  for (const path of COMMON_FEED_PATHS) {
    const tryUrl = new URL(path, homepageUrl).toString();
    if (!(await isAllowed(tryUrl))) continue;
    try {
      const res = await politely(tryUrl, () => httpGet(tryUrl));
      if (res.ok && looksLikeFeed(res.contentType, res.body)) {
        return tryUrl;
      }
    } catch {
      // ignore and try next
    }
  }
  return null;
}
