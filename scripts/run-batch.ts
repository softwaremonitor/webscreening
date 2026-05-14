#!/usr/bin/env tsx
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { runBatch } from "@/lib/batch/run";
import { logger } from "@/lib/logger";

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes("--backfill")
    ? "backfill"
    : args.includes("--manual")
      ? "manual"
      : "daily";
  logger.info({ mode }, "starting batch from CLI");
  try {
    const res = await runBatch({ mode });
    logger.info(res, "batch completed");
    process.exit(0);
  } catch (err) {
    logger.error({ err: (err as Error).message }, "batch failed");
    process.exit(1);
  }
}

main();
