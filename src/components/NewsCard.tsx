import type { ArticleDTO } from "@/lib/serialize";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function NewsCard({ article }: { article: ArticleDTO }) {
  return (
    <article className="py-3 border-b border-slate-200 last:border-0">
      <h2 className="news-title font-semibold text-slate-900">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          {article.shortTitle}
        </a>
        <span className="text-slate-400 font-normal"> — {formatDate(article.publishedAt)}</span>
      </h2>
      <p className="news-body mt-1 text-slate-700">{article.excerpt}</p>
      <p className="news-body mt-1 text-slate-600">
        Source :{" "}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-accent hover:underline"
        >
          {article.source.name}
        </a>
        {article.matchedKeywords.length > 0 && (
          <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
            {article.matchedKeywords.slice(0, 5).map((k) => (
              <span key={k} className="chip">
                {k}
              </span>
            ))}
          </span>
        )}
      </p>
    </article>
  );
}
