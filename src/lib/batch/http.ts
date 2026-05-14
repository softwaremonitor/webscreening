import { logger } from "@/lib/logger";

const USER_AGENT =
  process.env.USER_AGENT ?? "PackagingNewsBot/0.1 (+local-dev)";

const TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 20000);

export interface FetchResult {
  ok: boolean;
  status: number;
  url: string; // final URL after redirects
  body: string;
  contentType: string;
}

/**
 * GET a URL with a sensible UA, timeout, and basic redirect handling.
 * Returns the decoded text body even for non-2xx responses (the caller decides
 * whether to use it).
 */
export async function httpGet(url: string): Promise<FetchResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml;q=0.9,application/atom+xml;q=0.9,*/*;q=0.5",
        "Accept-Language": "en;q=0.9,fr;q=0.8,de;q=0.6,it;q=0.6,es;q=0.6",
      },
    });
    const contentType = res.headers.get("content-type") ?? "";
    let body: string;
    try {
      body = await res.text();
    } catch (err) {
      logger.warn({ err, url }, "failed to read response body");
      body = "";
    }
    return {
      ok: res.ok,
      status: res.status,
      url: res.url || url,
      body,
      contentType,
    };
  } catch (err) {
    logger.warn({ err: (err as Error).message, url }, "http get failed");
    return { ok: false, status: 0, url, body: "", contentType: "" };
  } finally {
    clearTimeout(timer);
  }
}
