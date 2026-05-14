import { load, type CheerioAPI } from "cheerio";
import { httpGet } from "@/lib/batch/http";
import { politely } from "@/lib/batch/rateLimit";
import { isAllowed } from "@/lib/batch/robots";
import { stripHtml } from "@/lib/text";
import { logger } from "@/lib/logger";
import type { ArticleCandidate } from "@/lib/batch/types";

function pickMeta($: CheerioAPI, names: string[]): string | undefined {
  for (const n of names) {
    const sel = n.startsWith("og:") || n.startsWith("article:") || n.startsWith("twitter:")
      ? `meta[property="${n}"], meta[name="${n}"]`
      : `meta[name="${n}"]`;
    const v = $(sel).attr("content")?.trim();
    if (v) return v;
  }
  return undefined;
}

function pickDate($: CheerioAPI): Date | undefined {
  const candidates: (string | undefined)[] = [
    pickMeta($, ["article:published_time", "og:article:published_time"]),
    pickMeta($, ["datePublished", "publication_date", "DC.date.issued"]),
    pickMeta($, ["pubdate", "publishdate", "publish_date"]),
    $("time[datetime]").attr("datetime") ?? undefined,
  ];
  for (const s of candidates) {
    if (!s) continue;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  // Look at JSON-LD blocks
  const ldNodes = $('script[type="application/ld+json"]').toArray();
  for (const node of ldNodes) {
    const text = $(node).contents().text();
    if (!text) continue;
    try {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const dt = item?.datePublished ?? item?.dateCreated ?? item?.uploadDate;
        if (typeof dt === "string") {
          const d = new Date(dt);
          if (!isNaN(d.getTime())) return d;
        }
      }
    } catch {
      // ignore non-JSON
    }
  }
  return undefined;
}

export interface ExtractResult {
  title?: string;
  excerpt?: string;
  content?: string;
  publishedAt?: Date;
  language?: string;
  canonicalUrl?: string;
  finalUrl: string;
}

/** Fetch an article URL and extract metadata. */
export async function extractArticle(url: string): Promise<ExtractResult | null> {
  if (!(await isAllowed(url))) {
    logger.info({ url }, "robots.txt disallows article");
    return null;
  }
  const res = await politely(url, () => httpGet(url));
  if (!res.ok || !res.body) return null;
  const $ = load(res.body);

  const title =
    pickMeta($, ["og:title", "twitter:title"]) ?? $("title").first().text().trim();
  const excerpt =
    pickMeta($, ["og:description", "twitter:description", "description"]) ??
    stripHtml($("article p").first().text());
  const canonical = $('link[rel="canonical"]').attr("href")?.trim();
  const lang = ($("html").attr("lang") ?? "").trim().split("-")[0] || undefined;
  const publishedAt = pickDate($);

  // Best-effort content: first ~3000 chars of joined paragraphs inside <article> or <main>.
  let content: string | undefined;
  const root = $("article").first().length
    ? $("article").first()
    : $("main").first().length
      ? $("main").first()
      : null;
  if (root) {
    const paragraphs = root
      .find("p")
      .toArray()
      .map((p) => $(p).text())
      .join("\n");
    content = stripHtml(paragraphs).slice(0, 4000) || undefined;
  }

  return {
    title: title || undefined,
    excerpt: excerpt || undefined,
    content,
    publishedAt,
    language: lang,
    canonicalUrl: canonical || undefined,
    finalUrl: res.url,
  };
}

/** Merge an extracted result into an ArticleCandidate, preferring existing fields. */
export function mergeCandidate(
  candidate: ArticleCandidate,
  extracted: ExtractResult
): ArticleCandidate {
  return {
    url: extracted.finalUrl || candidate.url,
    title: candidate.title ?? extracted.title,
    excerpt: candidate.excerpt ?? extracted.excerpt,
    content: candidate.content ?? extracted.content,
    publishedAt: candidate.publishedAt ?? extracted.publishedAt,
    language: candidate.language ?? extracted.language,
    canonicalUrl: extracted.canonicalUrl ?? candidate.canonicalUrl ?? candidate.url,
  };
}
