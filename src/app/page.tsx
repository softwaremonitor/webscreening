import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { toArticleDTO } from "@/lib/serialize";
import { NewsCard } from "@/components/NewsCard";
import { Filters } from "@/components/Filters";
import { Pagination } from "@/components/Pagination";

interface SearchParams {
  source?: string;
  keyword?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: string;
  lang?: string;
}

const PAGE_SIZE = 20;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where: Record<string, unknown> = { status: "published" };
  if (sp.source) where.sourceId = sp.source;
  if (sp.lang) where.language = sp.lang;
  if (sp.from || sp.to) {
    const range: Record<string, Date> = {};
    if (sp.from) range.gte = new Date(sp.from);
    if (sp.to) range.lte = new Date(sp.to);
    where.publishedAt = range;
  }
  if (sp.keyword) {
    where.matchedKeywords = { contains: JSON.stringify(sp.keyword).slice(1, -1) };
  }
  if (sp.q) {
    const term = sp.q.trim();
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
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        source: { select: { id: true, name: true, homepageUrl: true } },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const articles = items.map(toArticleDTO);

  return (
    <div>
      <Suspense>
        <Filters />
      </Suspense>
      <div className="bg-white border border-slate-200 rounded-md px-6 py-4">
        <div className="flex items-baseline justify-between mb-2">
          <h1 className="text-base font-semibold text-slate-900">Actualités</h1>
          <span className="text-xs text-slate-500">{total} résultats</span>
        </div>
        {articles.length === 0 ? (
          <p className="news-body text-slate-500 py-6">
            Aucune news pour l'instant. Lance un batch depuis l'admin pour collecter les premiers articles.
          </p>
        ) : (
          <div>
            {articles.map((a) => (
              <NewsCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </div>
      <Suspense>
        <Pagination page={page} totalPages={totalPages} />
      </Suspense>
    </div>
  );
}
