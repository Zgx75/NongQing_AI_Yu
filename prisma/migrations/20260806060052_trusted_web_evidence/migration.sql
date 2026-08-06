-- CreateTable
CREATE TABLE "TrustedWebSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "searchScope" TEXT NOT NULL DEFAULT 'PAGE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrustedWebSource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EvidenceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmRecordId" TEXT,
    "createdById" TEXT,
    "webSourceId" TEXT,
    "provider" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "sourceExcerpt" TEXT,
    "relevanceScore" REAL,
    "queryJson" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "EvidenceSnapshot_farmRecordId_fkey" FOREIGN KEY ("farmRecordId") REFERENCES "FarmRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvidenceSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EvidenceSnapshot_webSourceId_fkey" FOREIGN KEY ("webSourceId") REFERENCES "TrustedWebSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EvidenceSnapshot" ("cacheHit", "errorMessage", "farmRecordId", "fetchedAt", "id", "provider", "queryJson", "responseJson", "sourceName", "status", "summary") SELECT "cacheHit", "errorMessage", "farmRecordId", "fetchedAt", "id", "provider", "queryJson", "responseJson", "sourceName", "status", "summary" FROM "EvidenceSnapshot";
DROP TABLE "EvidenceSnapshot";
ALTER TABLE "new_EvidenceSnapshot" RENAME TO "EvidenceSnapshot";
CREATE INDEX "EvidenceSnapshot_createdById_fetchedAt_idx" ON "EvidenceSnapshot"("createdById", "fetchedAt");
CREATE INDEX "EvidenceSnapshot_farmRecordId_fetchedAt_idx" ON "EvidenceSnapshot"("farmRecordId", "fetchedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TrustedWebSource_url_key" ON "TrustedWebSource"("url");

-- CreateIndex
CREATE INDEX "TrustedWebSource_isActive_idx" ON "TrustedWebSource"("isActive");
