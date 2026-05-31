#!/usr/bin/env tsx
/**
 * One-shot migration: fix source records for the URLs that we diagnosed as
 * dead, wrong, or blocked-by-robots.
 *
 *   npx tsx scripts/migrate-source-urls.ts
 *
 * Idempotent: matches by current name and only writes when fields differ.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Patch {
  name: string;
  homepageUrl?: string;
  feedUrl?: string | null;
  sitemapUrl?: string | null;
  fetchStrategy?: "auto" | "rss" | "sitemap" | "html";
  enabled?: boolean;
  notes?: string;
  reason: string;
}

const PATCHES: Patch[] = [
  {
    name: "Tecnopack",
    homepageUrl: "https://www.tecnopack.com",
    feedUrl: null,
    sitemapUrl: null,
    fetchStrategy: "auto",
    reason: "tecnopack.es is NXDOMAIN; current host is tecnopack.com",
  },
  {
    name: "Packinfo",
    homepageUrl: "https://www.packinfo.com",
    feedUrl: null,
    sitemapUrl: null,
    fetchStrategy: "auto",
    reason: "packinfo.fr is NXDOMAIN; current host is packinfo.com",
  },
  {
    name: "Conseil National de l'Emballage",
    homepageUrl: "https://www.conseil-emballage.org",
    feedUrl: null,
    sitemapUrl: null,
    fetchStrategy: "auto",
    reason: "domain uses hyphens: conseil-emballage.org",
  },
  {
    name: "Packaging Strategies",
    feedUrl: "https://www.packagingstrategies.com/rss/articles",
    fetchStrategy: "rss",
    reason: "real feed advertised via <link rel=alternate> on homepage",
  },
  {
    name: "Canadian Packaging",
    sitemapUrl: "https://www.canadianpackaging.com/sitemap_index.xml",
    feedUrl: null,
    fetchStrategy: "sitemap",
    reason: "robots.txt disallows /feed/ for all UAs; sitemap is allowed",
  },
  {
    name: "Cahiers Techniques Pharma",
    enabled: false,
    notes:
      "Disabled 2026-05-31: cahiers-techniques-pharma.com is NXDOMAIN and no alternate domain was found.",
    reason: "no live domain found",
  },
];

async function main() {
  let updated = 0;
  let missing = 0;
  let unchanged = 0;
  for (const p of PATCHES) {
    const src = await prisma.source.findFirst({ where: { name: p.name } });
    if (!src) {
      console.log(`SKIP  ${p.name}: no matching source`);
      missing++;
      continue;
    }
    const data: Record<string, unknown> = {};
    if (p.homepageUrl && p.homepageUrl !== src.homepageUrl)
      data.homepageUrl = p.homepageUrl;
    if (p.feedUrl !== undefined && p.feedUrl !== src.feedUrl)
      data.feedUrl = p.feedUrl;
    if (p.sitemapUrl !== undefined && p.sitemapUrl !== src.sitemapUrl)
      data.sitemapUrl = p.sitemapUrl;
    if (p.fetchStrategy && p.fetchStrategy !== src.fetchStrategy)
      data.fetchStrategy = p.fetchStrategy;
    if (p.enabled !== undefined && p.enabled !== src.enabled)
      data.enabled = p.enabled;
    if (p.notes !== undefined && p.notes !== src.notes) data.notes = p.notes;

    if (Object.keys(data).length === 0) {
      console.log(`OK    ${p.name}: already up-to-date`);
      unchanged++;
      continue;
    }
    await prisma.source.update({ where: { id: src.id }, data });
    console.log(
      `FIX   ${p.name}: ${Object.keys(data).join(", ")}  — ${p.reason}`
    );
    updated++;
  }
  console.log(`\n=== ${updated} updated, ${unchanged} unchanged, ${missing} missing ===`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
