-- Remove authentication and imported documents; preserve tags, providers and search settings.
DROP TABLE IF EXISTS "DocumentTag";
DROP TABLE IF EXISTS "AnalysisJob";
DROP TABLE IF EXISTS "DocumentChunk";
DROP TABLE IF EXISTS "Document";

CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "originalFileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL, "filePath" TEXT NOT NULL, "fileSize" INTEGER NOT NULL,
    "textContent" TEXT, "language" TEXT, "primaryTopic" TEXT, "difficulty" TEXT,
    "summary" TEXT, "analysisReason" TEXT, "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "DocumentTag" (
    "documentId" TEXT NOT NULL, "tagId" TEXT NOT NULL, "confidence" REAL NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'AI', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("documentId", "tagId"),
    CONSTRAINT "DocumentTag_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "AnalysisJob" (
    "id" TEXT NOT NULL PRIMARY KEY, "documentId" TEXT NOT NULL, "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING', "progress" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT, "startedAt" DATETIME, "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AnalysisJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL PRIMARY KEY, "documentId" TEXT NOT NULL, "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL, "tokenCount" INTEGER, "pageNumber" INTEGER, "sourceLabel" TEXT,
    "embedding" BLOB, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Tag_new" (
    "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "normalizedName" TEXT NOT NULL,
    "description" TEXT, "embedding" BLOB, "isClassificationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
INSERT INTO "Tag_new" SELECT "id", "name", "normalizedName", "description", "embedding", "isClassificationEnabled", "createdAt", "updatedAt" FROM "Tag";
CREATE TABLE "TagAlias_new" (
    "id" TEXT NOT NULL PRIMARY KEY, "tagId" TEXT NOT NULL, "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TagAlias_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag_new" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "TagAlias_new" SELECT "id", "tagId", "alias", "normalizedAlias", "createdAt" FROM "TagAlias";
DROP TABLE "TagAlias";
DROP TABLE "Tag";
ALTER TABLE "Tag_new" RENAME TO "Tag";
ALTER TABLE "TagAlias_new" RENAME TO "TagAlias";

CREATE TABLE "AiProvider_new" (
    "id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "displayName" TEXT NOT NULL,
    "baseUrl" TEXT, "apiKeyEncrypted" TEXT, "defaultChatModel" TEXT,
    "defaultEmbeddingModel" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT false,
    "authStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "AiProvider_new" SELECT "id", "type", "displayName", "baseUrl", "apiKeyEncrypted", "defaultChatModel", "defaultEmbeddingModel", "isActive", "authStatus", "createdAt", "updatedAt" FROM "AiProvider";
DROP TABLE "AiProvider";
ALTER TABLE "AiProvider_new" RENAME TO "AiProvider";

CREATE TABLE "SearchLog_new" (
    "id" TEXT NOT NULL PRIMARY KEY, "query" TEXT NOT NULL, "filters" JSONB,
    "resultDocumentIds" JSONB NOT NULL DEFAULT [], "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "SearchLog_new" SELECT "id", "query", "filters", "resultDocumentIds", "createdAt" FROM "SearchLog";
DROP TABLE "SearchLog";
ALTER TABLE "SearchLog_new" RENAME TO "SearchLog";

DROP TABLE IF EXISTS "Account";
DROP TABLE IF EXISTS "Session";
DROP TABLE IF EXISTS "VerificationToken";
DROP TABLE IF EXISTS "User";

CREATE INDEX "Document_createdAt_idx" ON "Document"("createdAt");
CREATE INDEX "Document_status_idx" ON "Document"("status");
CREATE INDEX "Document_primaryTopic_idx" ON "Document"("primaryTopic");
CREATE INDEX "Tag_name_idx" ON "Tag"("name");
CREATE INDEX "Tag_normalizedName_idx" ON "Tag"("normalizedName");
CREATE INDEX "TagAlias_normalizedAlias_idx" ON "TagAlias"("normalizedAlias");
CREATE UNIQUE INDEX "TagAlias_tagId_normalizedAlias_key" ON "TagAlias"("tagId", "normalizedAlias");
CREATE INDEX "DocumentTag_tagId_idx" ON "DocumentTag"("tagId");
CREATE INDEX "AnalysisJob_documentId_createdAt_idx" ON "AnalysisJob"("documentId", "createdAt");
CREATE INDEX "AnalysisJob_status_type_idx" ON "AnalysisJob"("status", "type");
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");
CREATE UNIQUE INDEX "DocumentChunk_documentId_chunkIndex_key" ON "DocumentChunk"("documentId", "chunkIndex");
CREATE INDEX "SearchLog_createdAt_idx" ON "SearchLog"("createdAt");
