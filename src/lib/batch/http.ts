import { Agent, fetch as undiciFetch } from "undici";
import { logger } from "@/lib/logger";

const TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 20000);
const MAX_RETRIES = Number(process.env.HTTP_MAX_RETRIES ?? 2);
const MAX_RETRY_WAIT_MS = Number(process.env.HTTP_MAX_RETRY_WAIT_MS ?? 30_000);

// Realistic Chrome-on-macOS fingerprint. Many CDNs (Cloudflare, Akamai)
// blanket-block obvious bot UAs; a stable browser UA is the single biggest
// unblocker. The legacy "PackagingNewsBot" UA is kept as an opt-in fallback
// via env so polite/identified scraping is still possible.
const BROWSER_UA =
  process.env.USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// HTTP/2-capable dispatcher. Some hardened sites refuse HTTP/1.1 from Node's
// default TLS fingerprint; negotiating h2 gets us through more of them.
const dispatcher = new Agent({
  allowH2: true,
  connections: 64,
  headersTimeout: TIMEOUT_MS,
  bodyTimeout: TIMEOUT_MS,
  connect: { timeout: 10_000 },
});

export interface FetchResult {
  ok: boolean;
  status: number;
  url: string; // final URL after redirects
  body: string;
  contentType: string;
  headers: Record<string, string>;
}

function browserHeaders(url: string): Record<string, string> {
  const u = new URL(url);
  const isFeedPath = /\.(xml|rss|atom)(\?|$)|\/feed\/?$|\/rss\/?$/i.test(
    u.pathname + u.search
  );
  return {
    "User-Agent": BROWSER_UA,
    Accept: isFeedPath
      ? "application/rss+xml,application/atom+xml,application/xml;q=0.9,text/xml;q=0.8,*/*;q=0.5"
      : "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8,de;q=0.6,it;q=0.5,es;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1",
    // Sec-Fetch-* mimics a real navigation. CDNs check these to distinguish
    // browsers from scripted clients.
    "Sec-Fetch-Dest": isFeedPath ? "empty" : "document",
    "Sec-Fetch-Mode": isFeedPath ? "cors" : "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "sec-ch-ua":
      '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    // Referer = site root: cheap signal that we arrived through normal browsing.
    Referer: `${u.protocol}//${u.host}/`,
  };
}

function headersToObject(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}

function parseRetryAfter(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const secs = Number(value);
  if (Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, MAX_RETRY_WAIT_MS);
  const at = Date.parse(value);
  if (!Number.isNaN(at)) return Math.min(Math.max(0, at - Date.now()), MAX_RETRY_WAIT_MS);
  return undefined;
}

async function attempt(url: string): Promise<FetchResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await undiciFetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: browserHeaders(url),
      dispatcher,
    });
    const contentType = res.headers.get("content-type") ?? "";
    const headers = headersToObject(res.headers);
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
      headers,
    };
  } catch (err) {
    logger.warn({ err: (err as Error).message, url }, "http get failed");
    return { ok: false, status: 0, url, body: "", contentType: "", headers: {} };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET a URL with browser-like headers, HTTP/2, and basic redirect handling.
 * Retries once or twice on 429/503/transient network errors, honoring
 * Retry-After when present. Returns the decoded text body even for non-2xx
 * responses (the caller decides whether to use it).
 */
export async function httpGet(url: string): Promise<FetchResult> {
  let last: FetchResult = await attempt(url);
  for (let i = 0; i < MAX_RETRIES; i++) {
    const retryable =
      last.status === 429 ||
      last.status === 503 ||
      last.status === 502 ||
      last.status === 504 ||
      last.status === 0;
    if (!retryable) break;
    const hinted = parseRetryAfter(last.headers["retry-after"]);
    const backoff = Math.min(MAX_RETRY_WAIT_MS, 1000 * Math.pow(2, i) + Math.random() * 500);
    const wait = hinted ?? backoff;
    logger.info({ url, status: last.status, wait, attempt: i + 1 }, "retrying request");
    await new Promise((r) => setTimeout(r, wait));
    last = await attempt(url);
  }
  return last;
}
