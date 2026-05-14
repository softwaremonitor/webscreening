import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const TZ = process.env.BATCH_TIMEZONE ?? "Europe/Paris";

export interface TimeWindow {
  since: Date;
  until: Date;
  label: string;
}

/**
 * The window for the daily batch: yesterday 00:00:01 → yesterday 23:59:59
 * in the configured timezone, converted to UTC for storage.
 */
export function dailyWindow(now: Date = new Date()): TimeWindow {
  const yesterdayLabel = formatInTimeZone(
    new Date(now.getTime() - 24 * 60 * 60 * 1000),
    TZ,
    "yyyy-MM-dd"
  );
  const since = fromZonedTime(`${yesterdayLabel}T00:00:01`, TZ);
  const until = fromZonedTime(`${yesterdayLabel}T23:59:59`, TZ);
  return { since, until, label: `daily ${yesterdayLabel}` };
}

/** A backfill window covering the last `days` days up to "now". */
export function backfillWindow(days = 30, now: Date = new Date()): TimeWindow {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { since, until: now, label: `backfill last ${days}d` };
}
