import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, guardAdmin, notFound } from "@/lib/apiErrors";

const Update = z.object({
  name: z.string().min(1).max(200).optional(),
  homepageUrl: z.string().url().optional(),
  feedUrl: z.string().url().nullable().optional(),
  sitemapUrl: z.string().url().nullable().optional(),
  fetchStrategy: z.enum(["auto", "rss", "sitemap", "html"]).optional(),
  defaultLanguage: z.string().min(2).max(8).nullable().optional(),
  perDayLimit: z.coerce.number().int().min(0).max(1000).optional(),
  enabled: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardAdmin();
  if (guard) return guard;
  const { id } = await ctx.params;
  const item = await prisma.source.findUnique({ where: { id } });
  if (!item) return notFound();
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardAdmin();
  if (guard) return guard;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = Update.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.flatten());
  try {
    const updated = await prisma.source.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ item: updated });
  } catch (err) {
    return notFound((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardAdmin();
  if (guard) return guard;
  const { id } = await ctx.params;
  try {
    await prisma.source.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return notFound((err as Error).message);
  }
}
