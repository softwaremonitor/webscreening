#!/usr/bin/env tsx
/**
 * Standalone probe of all originally-failing sources. Loads each source from
 * the DB (so URL migrations are respected), runs the same fetch path the
 * batch uses (primary strategy → Google News fallback), and reports the
 * effective number of candidates per source. Does not write articles.
 *
 *   npx tsx scripts/test-failing.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { PrismaClient } from "@prisma/client";
import { fetchFromRss } from "../src/lib/batch/fetchers/rss";
import { fetchFromSitemap } from "../src/lib/batch/fetchers/sitemap";
import { fetchFromHtml } from "../src/lib/batch/fetchers/html";
import { fetchFromGoogleNews } from "../src/lib/batch/fetchers/googleNews";
import { discoverFeedUrl } from "../src/lib/batch/discover";
import type { ArticleCandidate, FetcherResult } from "../src/lib/batch/types";
import type { Source } from "@prisma/client";

const prisma = new PrismaClient();

const TARGET_NAMES = [
  "Packaging Digest",
  "Packaging World",
  "Labels & Labeling",
  "Packaging Strategies",
  "Healthcare Packaging",
  "Usine Nouvelle — Emballage",
  "Canadian Packaging",
  "Cahiers Techniques Pharma",
  "Packinfo",
  "K-Profi",
  "PackMedia",
  "Packaging Speaks Green",
  "EPRO Plastics Recycling",
  "Tecnopack",
  "Emballages Magazine",
  "Conseil National de l'Emballage",
  "RecyClass",
  "Paris Packaging Week",
  "Empack",
  "Sealed Air",
];

function pad(s: string, n: number) {
  return s.length >= n ? s.slice(0, n - 1) + "…" : s + " ".repeat(n - s.length);
}

async function tryPrimary(source: Source): Promise<{
  candidates: ArticleCandidate[];
  via: string;
  err?: string;
}> {
  const safe = async (
    label: string,
    fn: () => Promise<FetcherResult>
  ): Promise<{ candidates: ArticleCandidate[]; via: string; err?: string }> => {
    try {
      const r = await fn();
      return { candidates: r.candidates, via: label };
    } catch (e) {
      return { candidates: [], via: label, err: (e as Error).message };
    }
  };

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const strategy = source.fetchStrategy;
  if ((strategy === "rss" || strategy === "auto") && source.feedUrl) {
    const r = await safe(`rss(${source.feedUrl})`, () =>
      fetchFromRss(source.feedUrl!)
    );
    if (r.candidates.length > 0 || strategy === "rss") return r;
  }
  if ((strategy === "sitemap" || strategy === "auto") && source.sitemapUrl) {
    const r = await safe(`sitemap(${source.sitemapUrl})`, () =>
      fetchFromSitemap(source.sitemapUrl!, since)
    );
    if (r.candidates.length > 0 || strategy === "sitemap") return r;
  }
  if (strategy === "auto") {
    const discovered = await discoverFeedUrl(source.homepageUrl).catch(
      () => null
    );
    if (discovered) {
      const r = await safe(`discovered-rss(${discovered})`, () =>
        fetchFromRss(discovered)
      );
      if (r.candidates.length > 0) return r;
    }
  }
  if (strategy === "html" || strategy === "auto") {
    return safe(`html(${source.homepageUrl})`, () =>
      fetchFromHtml(source.homepageUrl)
    );
  }
  return { candidates: [], via: "none" };
}

async function probe(source: Source) {
  const started = Date.now();
  const primary = await tryPrimary(source);
  if (primary.candidates.length > 0) {
    return {
      ok: true,
      via: "primary:" + primary.via.split("(")[0],
      count: primary.candidates.length,
      ms: Date.now() - started,
    };
  }
  // Fallback to Google News.
  try {
    const gn = await fetchFromGoogleNews(
      source.homepageUrl,
      source.defaultLanguage
    );
    if (gn.candidates.length > 0) {
      return {
        ok: true,
        via: "google-news",
        count: gn.candidates.length,
        ms: Date.now() - started,
      };
    }
    return {
      ok: false,
      via: "exhausted",
      count: 0,
      ms: Date.now() - started,
      err: primary.err ?? "no candidates",
    };
  } catch (e) {
    return {
      ok: false,
      via: "google-news-error",
      count: 0,
      ms: Date.now() - started,
      err: (e as Error).message,
    };
  }
}

async function main() {
  const sources = await prisma.source.findMany({
    where: { name: { in: TARGET_NAMES } },
  });
  const byName = new Map(sources.map((s) => [s.name, s]));
  console.log(`Probing ${TARGET_NAMES.length} originally-failing sources…\n`);
  let okCount = 0;
  let viaPrimary = 0;
  let viaGoogle = 0;
  for (const name of TARGET_NAMES) {
    const s = byName.get(name);
    if (!s) {
      console.log(`MISS  ${pad(name, 36)}  not in DB`);
      continue;
    }
    if (!s.enabled) {
      console.log(`OFF   ${pad(name, 36)}  disabled (${s.notes ?? "n/a"})`);
      continue;
    }
    const r = await probe(s);
    const tag = r.ok ? "OK  " : "FAIL";
    if (r.ok) {
      okCount++;
      if (r.via.startsWith("primary")) viaPrimary++;
      else if (r.via === "google-news") viaGoogle++;
    }
    const detail = r.ok
      ? `via=${r.via} items=${r.count} (${r.ms}ms)`
      : `via=${r.via} err=${(r.err ?? "").slice(0, 70)}`;
    console.log(`${tag}  ${pad(name, 36)}  ${detail}`);
  }
  console.log(
    `\n=== ${okCount}/${TARGET_NAMES.length} unblocked (primary: ${viaPrimary}, google-news: ${viaGoogle}) ===`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
