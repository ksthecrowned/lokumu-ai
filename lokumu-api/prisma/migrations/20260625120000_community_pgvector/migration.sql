-- Community contributions for crowd-sourced RAG enrichment
CREATE TABLE "CommunityContribution" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "language" TEXT NOT NULL,
    "originalQuery" TEXT NOT NULL,
    "originalAnswer" TEXT NOT NULL,
    "correctedAnswer" TEXT NOT NULL,
    "contributorNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "ingestedAt" TIMESTAMP(3),
    "chunkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityContribution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunityContribution_status_language_idx" ON "CommunityContribution"("status", "language");
CREATE INDEX "CommunityContribution_createdAt_idx" ON "CommunityContribution"("createdAt");
