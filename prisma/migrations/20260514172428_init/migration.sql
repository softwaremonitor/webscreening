-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "homepageUrl" TEXT NOT NULL,
    "feedUrl" TEXT,
    "sitemapUrl" TEXT,
    "fetchStrategy" TEXT NOT NULL DEFAULT 'auto',
    "defaultLanguage" TEXT,
    "perDayLimit" INTEGER NOT NULL DEFAULT 10,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "isPhrase" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "originalTitle" TEXT NOT NULL,
    "shortTitle" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "rawExcerpt" TEXT,
    "rawContent" TEXT,
    "url" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "language" TEXT,
    "status" TEXT NOT NULL DEFAULT 'published',
    "matchedKeywords" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Article_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BatchRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'running',
    "mode" TEXT NOT NULL DEFAULT 'daily',
    "sourcesAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "articlesFound" INTEGER NOT NULL DEFAULT 0,
    "articlesAdded" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "durationMs" INTEGER
);

-- CreateTable
CREATE TABLE "BatchSourceError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatchSourceError_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BatchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BatchSourceError_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_homepageUrl_key" ON "Source"("homepageUrl");

-- CreateIndex
CREATE INDEX "Source_enabled_idx" ON "Source"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_text_key" ON "Keyword"("text");

-- CreateIndex
CREATE INDEX "Keyword_enabled_idx" ON "Keyword"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "Article_canonicalUrl_key" ON "Article"("canonicalUrl");

-- CreateIndex
CREATE INDEX "Article_publishedAt_idx" ON "Article"("publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Article_sourceId_publishedAt_idx" ON "Article"("sourceId", "publishedAt");

-- CreateIndex
CREATE INDEX "Article_status_idx" ON "Article"("status");

-- CreateIndex
CREATE INDEX "BatchRun_startedAt_idx" ON "BatchRun"("startedAt" DESC);

-- CreateIndex
CREATE INDEX "BatchSourceError_batchId_idx" ON "BatchSourceError"("batchId");

-- CreateIndex
CREATE INDEX "BatchSourceError_sourceId_idx" ON "BatchSourceError"("sourceId");
