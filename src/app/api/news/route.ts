import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { toArticleDTO } from "@/lib/serialize";

const QuerySchema = z.object({
  source: z.string().optional(),
  keyword: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  lang: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad query", details: parsed.error.flatten() }, { status: 400 });
  }
  const { source, keyword, from, to, q, page, pageSize, lang } = parsed.data;
  const where: Record<string, unknown> = { status: "published" };
  if (source) where.sourceId = source;
  if (lang) where.language = lang;
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.publishedAt = range;
  }
  if (keyword) {
    // matchedKeywords is stored as JSON; SQLite has no JSON ops in Prisma, do a LIKE.
    where.matchedKeywords = { contains: JSON.stringify(keyword).slice(1, -1) };
  }
  if (q) {
    const term = q.trim();
    where.OR = [
      { originalTitle: { contains: term } },
      { shortTitle: { contains: term } },
      { excerpt: { contains: term } },
      { rawExcerpt: { contains: term } },
    ];
  }
  const [total, items] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        source: { select: { id: true, name: true, homepageUrl: true } },
      },
    }),
  ]);
  return NextResponse.json({
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: items.map(toArticleDTO),
  });
}
