import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [sources, keywords, langRows] = await Promise.all([
    prisma.source.findMany({
      where: { enabled: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.keyword.findMany({
      where: { enabled: true },
      select: { id: true, text: true },
      orderBy: { text: "asc" },
    }),
    prisma.article.findMany({
      where: { status: "published", language: { not: null } },
      select: { language: true },
      distinct: ["language"],
    }),
  ]);
  return NextResponse.json({
    sources,
    keywords,
    languages: langRows.map((l) => l.language).filter((v): v is string => Boolean(v)),
  });
}
