import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, guardAdmin } from "@/lib/apiErrors";

const Create = z.object({
  name: z.string().min(1).max(200),
  homepageUrl: z.string().url(),
  feedUrl: z.string().url().optional().nullable(),
  sitemapUrl: z.string().url().optional().nullable(),
  fetchStrategy: z.enum(["auto", "rss", "sitemap", "html"]).default("auto"),
  defaultLanguage: z.string().min(2).max(8).optional().nullable(),
  perDayLimit: z.coerce.number().int().min(0).max(1000).default(10),
  enabled: z.boolean().default(true),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET() {
  const guard = await guardAdmin();
  if (guard) return guard;
  const items = await prisma.source.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const guard = await guardAdmin();
  if (guard) return guard;
  const body = await req.json().catch(() => null);
  const parsed = Create.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.flatten());
  try {
    const created = await prisma.source.create({ data: parsed.data });
    return NextResponse.json({ item: created }, { status: 201 });
  } catch (err) {
    return badRequest("could not create source", (err as Error).message);
  }
}
