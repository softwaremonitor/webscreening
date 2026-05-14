import pLimit, { type LimitFunction } from "p-limit";
import { hostOf } from "@/lib/url";

const PER_HOST_CONCURRENCY = Number(process.env.PER_HOST_CONCURRENCY ?? 2);
const PER_HOST_MIN_DELAY_MS = Number(process.env.PER_HOST_MIN_DELAY_MS ?? 1500);

interface HostSlot {
  limit: LimitFunction;
  lastAt: number;
}

const slots = new Map<string, HostSlot>();

function getSlot(host: string): HostSlot {
  let slot = slots.get(host);
  if (!slot) {
    slot = { limit: pLimit(PER_HOST_CONCURRENCY), lastAt: 0 };
    slots.set(host, slot);
  }
  return slot;
}

/**
 * Serialize requests to a host with a minimum delay between them.
 * Polite scraping: do not hammer.
 */
export function politely<T>(url: string, task: () => Promise<T>): Promise<T> {
  const host = hostOf(url);
  const slot = getSlot(host);
  return slot.limit(async () => {
    const wait = Math.max(0, slot.lastAt + PER_HOST_MIN_DELAY_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await task();
    } finally {
      slot.lastAt = Date.now();
    }
  });
}
