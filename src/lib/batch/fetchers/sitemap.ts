import { XMLParser } from "fast-xml-parser";
import { httpGet } from "@/lib/batch/http";
import { politely } from "@/lib/batch/rateLimit";
import { isAllowed } from "@/lib/batch/robots";
import { logger } from "@/lib/logger";
import type { ArticleCandidate, FetcherResult } from "@/lib/batch/types";

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@" });

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  "news:news"?: {
    "news:publication_date"?: string;
    "news:title"?: string;
    "news:language"?: string;
  };
}

interface SitemapIndex {
  sitemap: { loc: string; lastmod?: string } | { loc: string; lastmod?: string }[];
}

interface UrlSet {
  url: SitemapUrl | SitemapUrl[];
}

async function readSitemap(url: string): Promise<UrlSet | SitemapIndex | null> {
  if (!(await isAllowed(url))) return null;
  const res = await politely(url, () => httpGet(url));
  if (!res.ok || !res.body) {
    throw new Error(`Sitemap fetch failed: ${res.status} ${url}`);
  }
  const parsed = xml.parse(res.body);
  if (parsed.urlset) return parsed.urlset as UrlSet;
  if (parsed.sitemapindex) return parsed.sitemapindex as SitemapIndex;
  return null;
}

export async function fetchFromSitemap(
  sitemapUrl: string,
  since: Date
): Promise<FetcherResult> {
  const visited = new Set<string>();
  const queue = [sitemapUrl];
  const candidates: ArticleCandidate[] = [];

  while (queue.length && visited.size < 20) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    let doc: UrlSet | SitemapIndex | null;
    try {
      doc = await readSitemap(url);
    } catch (err) {
      logger.warn({ err: (err as Error).message, url }, "sitemap read failed");
      continue;
    }
    if (!doc) continue;
    if ("sitemap" in doc) {
      const items = Array.isArray(doc.sitemap) ? doc.sitemap : [doc.sitemap];
      for (const s of items) {
        if (!s?.loc) continue;
        if (s.lastmod) {
          const lm = new Date(s.lastmod);
          if (!isNaN(lm.getTime()) && lm < since) continue;
        }
        queue.push(s.loc);
      }
    } else if ("url" in doc) {
      const items = Array.isArray(doc.url) ? doc.url : [doc.url];
      for (const u of items) {
        if (!u?.loc) continue;
        const newsDate = u["news:news"]?.["news:publication_date"];
        const dateStr = newsDate ?? u.lastmod;
        const publishedAt = dateStr ? new Date(dateStr) : undefined;
        if (publishedAt && !isNaN(publishedAt.getTime()) && publishedAt < since) {
          continue;
        }
        candidates.push({
          url: u.loc,
          title: u["news:news"]?.["news:title"],
          publishedAt:
            publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : undefined,
          language: u["news:news"]?.["news:language"]?.split("-")[0],
        });
      }
    }
  }
  return { candidates, origin: sitemapUrl };
}
