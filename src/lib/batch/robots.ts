import robotsParser from "robots-parser";
import { httpGet } from "@/lib/batch/http";
import { hostOf } from "@/lib/url";
import { logger } from "@/lib/logger";

const USER_AGENT_NAME = "PackagingNewsBot";

interface CachedRobots {
  parser: ReturnType<typeof robotsParser> | null;
  fetchedAt: number;
}

const cache = new Map<string, CachedRobots>();
const TTL_MS = 6 * 60 * 60 * 1000; // 6h

async function loadRobots(origin: string) {
  const robotsUrl = `${origin}/robots.txt`;
  const res = await httpGet(robotsUrl);
  if (!res.ok || !res.body) {
    return null;
  }
  return robotsParser(robotsUrl, res.body);
}

export async function isAllowed(url: string): Promise<boolean> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }
  const host = hostOf(url);
  const now = Date.now();
  let entry = cache.get(host);
  if (!entry || now - entry.fetchedAt > TTL_MS) {
    try {
      const parser = await loadRobots(origin);
      entry = { parser, fetchedAt: now };
      cache.set(host, entry);
    } catch (err) {
      logger.warn({ err: (err as Error).message, host }, "robots.txt fetch failed");
      entry = { parser: null, fetchedAt: now };
      cache.set(host, entry);
    }
  }
  if (!entry.parser) return true; // missing robots.txt → assume allowed
  const allowed = entry.parser.isAllowed(url, USER_AGENT_NAME);
  return allowed !== false;
}

export async function discoverSitemaps(origin: string): Promise<string[]> {
  const host = hostOf(origin);
  const entry = cache.get(host);
  if (entry?.parser) {
    const sm = entry.parser.getSitemaps();
    if (sm.length) return sm;
  }
  // Fallback: try the conventional path
  return [`${origin}/sitemap.xml`];
}
