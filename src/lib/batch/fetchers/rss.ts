import Parser from "rss-parser";
import { httpGet } from "@/lib/batch/http";
import { politely } from "@/lib/batch/rateLimit";
import { isAllowed } from "@/lib/batch/robots";
import { logger } from "@/lib/logger";
import { stripHtml } from "@/lib/text";
import type { ArticleCandidate, FetcherResult } from "@/lib/batch/types";

const parser: Parser<unknown, Record<string, unknown>> = new Parser({
  timeout: 20000,
});

export async function fetchFromRss(feedUrl: string): Promise<FetcherResult> {
  if (!(await isAllowed(feedUrl))) {
    logger.info({ feedUrl }, "robots.txt disallows feed");
    return { candidates: [], origin: feedUrl };
  }
  const res = await politely(feedUrl, () => httpGet(feedUrl));
  if (!res.ok || !res.body) {
    throw new Error(`RSS fetch failed: ${res.status} ${feedUrl}`);
  }
  const feed = await parser.parseString(res.body);
  const candidates: ArticleCandidate[] = [];
  for (const item of feed.items ?? []) {
    if (!item.link) continue;
    const pubRaw =
      (item.isoDate as string | undefined) ??
      (item.pubDate as string | undefined) ??
      undefined;
    const publishedAt = pubRaw ? new Date(pubRaw) : undefined;
    const excerpt = stripHtml(
      (item.contentSnippet as string | undefined) ??
        (item.summary as string | undefined) ??
        (item.content as string | undefined) ??
        ""
    );
    const content = stripHtml(
      ((item as Record<string, unknown>)["content:encoded"] as string | undefined) ??
        (item.content as string | undefined) ??
        ""
    );
    candidates.push({
      url: item.link,
      title: item.title?.trim(),
      excerpt: excerpt || undefined,
      content: content || undefined,
      publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : undefined,
      language: ((feed as unknown as Record<string, unknown>).language as
        | string
        | undefined)?.split("-")[0],
    });
  }
  return { candidates, origin: feedUrl };
}
