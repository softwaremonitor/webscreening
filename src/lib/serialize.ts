import type { Article, Source } from "@prisma/client";

export interface ArticleDTO {
  id: string;
  shortTitle: string;
  originalTitle: string;
  excerpt: string;
  url: string;
  canonicalUrl: string;
  publishedAt: string;
  detectedAt: string;
  language: string | null;
  matchedKeywords: string[];
  source: { id: string; name: string; homepageUrl: string };
}

export function toArticleDTO(
  a: Article & { source: Pick<Source, "id" | "name" | "homepageUrl"> }
): ArticleDTO {
  let matched: string[] = [];
  try {
    matched = a.matchedKeywords ? JSON.parse(a.matchedKeywords) : [];
  } catch {
    matched = [];
  }
  return {
    id: a.id,
    shortTitle: a.shortTitle,
    originalTitle: a.originalTitle,
    excerpt: a.excerpt,
    url: a.url,
    canonicalUrl: a.canonicalUrl,
    publishedAt: a.publishedAt.toISOString(),
    detectedAt: a.detectedAt.toISOString(),
    language: a.language,
    matchedKeywords: matched,
    source: a.source,
  };
}
