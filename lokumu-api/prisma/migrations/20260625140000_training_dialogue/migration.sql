-- Training dialogues for fine-tuning export pipeline
CREATE TABLE "TrainingDialogue" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "turns" JSONB NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'community',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "contributorNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "exportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingDialogue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainingDialogue_status_language_idx" ON "TrainingDialogue"("status", "language");
CREATE INDEX "TrainingDialogue_createdAt_idx" ON "TrainingDialogue"("createdAt");
