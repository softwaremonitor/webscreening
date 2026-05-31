import Parser from "rss-parser";
import { XMLParser } from "fast-xml-parser";
import { httpGet } from "@/lib/batch/http";
import { politely } from "@/lib/batch/rateLimit";
import { isAllowed } from "@/lib/batch/robots";
import { logger } from "@/lib/logger";
import { stripHtml } from "@/lib/text";
import type { ArticleCandidate, FetcherResult } from "@/lib/batch/types";

const parser: Parser<unknown, Record<string, unknown>> = new Parser({
  timeout: 20000,
});

// Permissive parser used only when rss-parser chokes on malformed XML
// ("Attribute without value", stray entities, etc.).
const permissive = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  trimValues: true,
  parseTagValue: false,
  processEntities: true,
  htmlEntities: true,
  // The big one: do not crash on attributes without values.
  allowBooleanAttributes: true,
});

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function pickText(node: unknown): string | undefined {
  if (typeof node === "string") return node;
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeof obj["#text"] === "string") return obj["#text"];
    if (typeof obj["#cdata"] === "string") return obj["#cdata"];
  }
  return undefined;
}

function pickLink(item: Record<string, unknown>): string | undefined {
  const raw = item.link;
  if (typeof raw === "string") return raw;
  // Atom: <link href="..."/>
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj["@href"] === "string") return obj["@href"];
    if (typeof obj["#text"] === "string") return obj["#text"];
  }
  if (Array.isArray(raw)) {
    for (const l of raw) {
      const u = pickLink({ link: l });
      if (u) return u;
    }
  }
  return undefined;
}

function parsePermissive(xml: string): ArticleCandidate[] {
  const doc = permissive.parse(xml) as Record<string, unknown>;
  // RSS 2.0: rss > channel > item ; Atom: feed > entry
  const rss = doc.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  const feed = doc.feed as Record<string, unknown> | undefined;
  const rawItems = asArray(channel?.item ?? feed?.entry) as Record<
    string,
    unknown
  >[];
  const channelLang = pickText(channel?.language ?? feed?.["@xml:lang"]);
  const out: ArticleCandidate[] = [];
  for (const it of rawItems) {
    const link = pickLink(it);
    if (!link) continue;
    const title = pickText(it.title);
    const dateStr =
      pickText(it.pubDate) ??
      pickText(it.published) ??
      pickText(it.updated) ??
      pickText((it as Record<string, unknown>)["dc:date"]);
    const publishedAt = dateStr ? new Date(dateStr) : undefined;
    const desc =
      pickText(it.description) ??
      pickText(it.summary) ??
      pickText((it as Record<string, unknown>)["content:encoded"]) ??
      pickText(it.content);
    const content =
      pickText((it as Record<string, unknown>)["content:encoded"]) ??
      pickText(it.content);
    out.push({
      url: link.trim(),
      title: title?.trim(),
      excerpt: desc ? stripHtml(desc) || undefined : undefined,
      content: content ? stripHtml(content) || undefined : undefined,
      publishedAt:
        publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : undefined,
      language: channelLang?.split("-")[0],
    });
  }
  return out;
}

export async function fetchFromRss(feedUrl: string): Promise<FetcherResult> {
  if (!(await isAllowed(feedUrl))) {
    logger.info({ feedUrl }, "robots.txt disallows feed");
    return { candidates: [], origin: feedUrl };
  }
  const res = await politely(feedUrl, () => httpGet(feedUrl));
  if (!res.ok || !res.body) {
    throw new Error(`RSS fetch failed: ${res.status} ${feedUrl}`);
  }

  // Try strict rss-parser first — its output is richer and better normalized.
  try {
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
        ((item as Record<string, unknown>)["content:encoded"] as
          | string
          | undefined) ??
          (item.content as string | undefined) ??
          ""
      );
      candidates.push({
        url: item.link,
        title: item.title?.trim(),
        excerpt: excerpt || undefined,
        content: content || undefined,
        publishedAt:
          publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : undefined,
        language: (
          (feed as unknown as Record<string, unknown>).language as
            | string
            | undefined
        )?.split("-")[0],
      });
    }
    return { candidates, origin: feedUrl };
  } catch (err) {
    logger.info(
      { err: (err as Error).message, feedUrl },
      "strict RSS parse failed, retrying with permissive parser"
    );
  }

  // Fallback: permissive XML parsing.
  try {
    const candidates = parsePermissive(res.body);
    if (candidates.length === 0) {
      throw new Error("permissive parser found 0 items");
    }
    logger.info(
      { feedUrl, count: candidates.length },
      "permissive RSS parser recovered feed"
    );
    return { candidates, origin: feedUrl };
  } catch (err) {
    throw new Error(
      `RSS parse failed (strict and permissive): ${(err as Error).message} ${feedUrl}`
    );
  }
}
