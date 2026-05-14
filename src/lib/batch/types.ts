export interface ArticleCandidate {
  url: string;
  title?: string;
  excerpt?: string;
  content?: string;
  publishedAt?: Date;
  language?: string;
  canonicalUrl?: string;
}

export interface FetcherResult {
  candidates: ArticleCandidate[];
  /** Human-readable describing which feed/URL we actually used. */
  origin: string;
}
