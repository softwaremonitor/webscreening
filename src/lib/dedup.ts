import { prisma } from "@/lib/prisma";
import { normalizeUrl } from "@/lib/url";

const STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "or", "for", "to", "in", "on", "at", "by", "with", "from",
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "pour", "à", "au", "aux", "dans", "sur",
  "der", "die", "das", "und", "oder", "für", "zu", "in", "auf", "mit", "von",
  "il", "lo", "gli", "le", "un", "uno", "una", "e", "o", "per", "di", "da", "con",
  "el", "la", "los", "las", "y", "o", "para", "de", "con", "en",
]);

function tokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t))
  );
}

export function titleSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Find an existing article that should be treated as a duplicate.
 * Same canonical URL, or sufficiently similar title published within 48h.
 */
export async function findDuplicate(candidate: {
  canonicalUrl: string;
  originalTitle: string;
  publishedAt: Date;
}): Promise<{ id: string } | null> {
  const normalized = normalizeUrl(candidate.canonicalUrl);
  const byUrl = await prisma.article.findUnique({
    where: { canonicalUrl: normalized },
    select: { id: true },
  });
  if (byUrl) return byUrl;

  const dayWindow = 48 * 60 * 60 * 1000;
  const after = new Date(candidate.publishedAt.getTime() - dayWindow);
  const before = new Date(candidate.publishedAt.getTime() + dayWindow);
  const recents = await prisma.article.findMany({
    where: { publishedAt: { gte: after, lte: before } },
    select: { id: true, originalTitle: true },
    take: 200,
  });
  for (const r of recents) {
    if (titleSimilarity(r.originalTitle, candidate.originalTitle) >= 0.85) {
      return { id: r.id };
    }
  }
  return null;
}
