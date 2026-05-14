import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runBatch } from "@/lib/batch/run";
import { guardAdmin, badRequest } from "@/lib/apiErrors";

const Body = z.object({
  mode: z.enum(["daily", "backfill", "manual"]).default("manual"),
  sourceId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const guard = await guardAdmin();
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.flatten());
  // Fire-and-forget: respond immediately, run in background.
  const result = runBatch(parsed.data).catch((err) => ({ error: (err as Error).message }));
  return NextResponse.json({ started: true, pending: Boolean(result) });
}
