import pLimit from "p-limit";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { normalizeUrl } from "@/lib/url";
import { excerpt, shorten, clean } from "@/lib/text";
import { buildHaystack, findMatches, parseKeyword } from "@/lib/keywords";
import { findDuplicate } from "@/lib/dedup";
import { fetchFromRss } from "@/lib/batch/fetchers/rss";
import { fetchFromSitemap } from "@/lib/batch/fetchers/sitemap";
import { fetchFromHtml } from "@/lib/batch/fetchers/html";
import { discoverFeedUrl } from "@/lib/batch/discover";
import { extractArticle, mergeCandidate } from "@/lib/batch/extract";
import { dailyWindow, backfillWindow, type TimeWindow } from "@/lib/batch/window";
import type { ArticleCandidate, FetcherResult } from "@/lib/batch/types";
import type { Source } from "@prisma/client";

const DEFAULT_PER_SOURCE = Number(process.env.DEFAULT_PER_SOURCE_DAILY_LIMIT ?? 10);
const GLOBAL_SOURCE_CONCURRENCY = Number(process.env.GLOBAL_SOURCE_CONCURRENCY ?? 6);

export type BatchMode = "daily" | "backfill" | "manual";

export interface RunOptions {
  mode: BatchMode;
  /** Override the time window (otherwise computed from mode). */
  window?: TimeWindow;
  /** Limit to a specific source (admin "test this source" button). */
  sourceId?: string;
}

interface SourceTally {
  source: Source;
  found: number;
  added: number;
  error?: string;
}

export async function runBatch(opts: RunOptions): Promise<{
  batchId: string;
  sourcesAnalyzed: number;
  articlesFound: number;
  articlesAdded: number;
  errorCount: number;
}> {
  const tw =
    opts.window ??
    (opts.mode === "backfill" ? backfillWindow(30) : dailyWindow());

  const batch = await prisma.batchRun.create({
    data: { status: "running", mode: opts.mode },
  });
  const startedAt = batch.startedAt.getTime();
  logger.info({ batchId: batch.id, window: tw, mode: opts.mode }, "batch started");

  let sources: Source[];
  if (opts.sourceId) {
    const one = await prisma.source.findUnique({ where: { id: opts.sourceId } });
    sources = one ? [one] : [];
  } else {
    sources = await prisma.source.findMany({ where: { enabled: true } });
  }

  const keywords = (
    await prisma.keyword.findMany({ where: { enabled: true } })
  ).map((k) => parseKeyword(k.text));

  if (keywords.length === 0) {
    logger.warn("no enabled keywords — no articles will be captured");
  }

  const limitSource = pLimit(GLOBAL_SOURCE_CONCURRENCY);
  const tallies: SourceTally[] = await Promise.all(
    sources.map((source) =>
      limitSource(async () => {
        const tally: SourceTally = { source, found: 0, added: 0 };
        try {
          const candidates = await collectCandidates(source, tw);
          const perDay =
            source.perDayLimit > 0 ? source.perDayLimit : DEFAULT_PER_SOURCE;
          const windowDays = Math.max(
            1,
            Math.ceil(
              (tw.until.getTime() - tw.since.getTime()) / (24 * 60 * 60 * 1000)
            )
          );
          const limit = perDay * windowDays;
          let stored = 0;
          for (const c of candidates) {
            if (stored >= limit) break;
            if (
              c.publishedAt &&
              (c.publishedAt < tw.since || c.publishedAt > tw.until)
            ) {
              continue;
            }
            tally.found += 1;
            const merged = await enrich(c, source);
            if (!merged) continue;
            if (!merged.publishedAt) continue;
            if (merged.publishedAt < tw.since || merged.publishedAt > tw.until)
              continue;
            const inserted = await persist(source, merged, keywords);
            if (inserted) {
              stored += 1;
              tally.added += 1;
            }
          }
        } catch (err) {
          const msg = (err as Error).message || String(err);
          tally.error = msg;
          await prisma.batchSourceError.create({
            data: {
              batchId: batch.id,
              sourceId: source.id,
              message: msg.slice(0, 1000),
            },
          });
          logger.warn({ err: msg, source: source.name }, "source failed");
        }
        return tally;
      })
    )
  );

  const sourcesAnalyzed = tallies.length;
  const articlesFound = tallies.reduce((a, b) => a + b.found, 0);
  const articlesAdded = tallies.reduce((a, b) => a + b.added, 0);
  const errorCount = tallies.filter((t) => t.error).length;
  const status =
    errorCount === 0 ? "success" : errorCount === sourcesAnalyzed ? "failed" : "partial";

  const finishedAt = new Date();
  await prisma.batchRun.update({
    where: { id: batch.id },
    data: {
      finishedAt,
      status,
      sourcesAnalyzed,
      articlesFound,
      articlesAdded,
      errorCount,
      durationMs: finishedAt.getTime() - startedAt,
      message: errorCount === 0 ? null : `${errorCount} source(s) failed`,
    },
  });
  logger.info(
    { batchId: batch.id, sourcesAnalyzed, articlesFound, articlesAdded, errorCount, status },
    "batch finished"
  );

  return { batchId: batch.id, sourcesAnalyzed, articlesFound, articlesAdded, errorCount };
}

async function collectCandidates(
  source: Source,
  tw: TimeWindow
): Promise<ArticleCandidate[]> {
  const strategy = source.fetchStrategy;

  if (strategy === "rss" || (strategy === "auto" && source.feedUrl)) {
    if (source.feedUrl) return (await fetchFromRss(source.feedUrl)).candidates;
  }
  if (strategy === "sitemap" || (strategy === "auto" && source.sitemapUrl)) {
    if (source.sitemapUrl)
      return (await fetchFromSitemap(source.sitemapUrl, tw.since)).candidates;
  }

  if (strategy === "auto") {
    const discovered = await discoverFeedUrl(source.homepageUrl);
    if (discovered) {
      await prisma.source.update({
        where: { id: source.id },
        data: { feedUrl: discovered },
      });
      logger.info({ source: source.name, feedUrl: discovered }, "discovered feed");
      return (await fetchFromRss(discovered)).candidates;
    }
  }

  // Last resort: scrape homepage HTML.
  const r: FetcherResult = await fetchFromHtml(source.homepageUrl);
  return r.candidates;
}

async function enrich(
  candidate: ArticleCandidate,
  source: Source
): Promise<ArticleCandidate | null> {
  const needsEnrich =
    !candidate.publishedAt ||
    !candidate.canonicalUrl ||
    !candidate.excerpt ||
    !candidate.title;
  if (!needsEnrich) return candidate;
  const extracted = await extractArticle(candidate.url);
  if (!extracted) {
    // Without a date we can't decide if it falls in window. Drop it.
    if (!candidate.publishedAt) return null;
    return candidate;
  }
  const merged = mergeCandidate(candidate, extracted);
  if (!merged.language && source.defaultLanguage) {
    merged.language = source.defaultLanguage;
  }
  return merged;
}

async function persist(
  source: Source,
  c: ArticleCandidate,
  keywords: ReturnType<typeof parseKeyword>[]
): Promise<boolean> {
  if (!c.publishedAt || !c.title) return false;
  const canonicalUrl = normalizeUrl(c.canonicalUrl ?? c.url);
  const url = c.url;

  const haystack = buildHaystack({
    title: c.title,
    excerpt: c.excerpt,
    content: c.content,
  });
  const hits = findMatches(haystack, keywords);
  if (hits.length === 0) return false;

  const dup = await findDuplicate({
    canonicalUrl,
    originalTitle: c.title,
    publishedAt: c.publishedAt,
  });
  if (dup) {
    logger.debug({ id: dup.id, url }, "duplicate skipped");
    return false;
  }

  const original = clean(c.title);
  const rawExcerpt = clean(c.excerpt ?? "");
  await prisma.article.create({
    data: {
      sourceId: source.id,
      originalTitle: original,
      shortTitle: shorten(original, 50),
      excerpt: excerpt(rawExcerpt || original, 200),
      rawExcerpt: rawExcerpt || null,
      rawContent: c.content ? c.content.slice(0, 8000) : null,
      url,
      canonicalUrl,
      publishedAt: c.publishedAt,
      language: c.language ?? source.defaultLanguage ?? null,
      matchedKeywords: JSON.stringify(hits),
    },
  });
  return true;
}
