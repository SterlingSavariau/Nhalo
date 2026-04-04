-- AlterTable
ALTER TABLE "ShortlistItem" ADD COLUMN     "choiceStatus" TEXT NOT NULL DEFAULT 'candidate',
ADD COLUMN     "decisionConfidence" TEXT,
ADD COLUMN     "decisionRationale" TEXT,
ADD COLUMN     "decisionRisksJson" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "droppedReason" TEXT,
ADD COLUMN     "lastDecisionReviewedAt" TIMESTAMP(3),
ADD COLUMN     "replacedByShortlistItemId" TEXT,
ADD COLUMN     "selectedAt" TIMESTAMP(3),
ADD COLUMN     "selectionRank" INTEGER,
ADD COLUMN     "statusChangedAt" TIMESTAMP(3);

-- Backfill lifecycle timestamps for existing shortlist items before enforcing non-null.
UPDATE "ShortlistItem"
SET "statusChangedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "statusChangedAt" IS NULL;

ALTER TABLE "ShortlistItem"
ALTER COLUMN "statusChangedAt" SET NOT NULL,
ALTER COLUMN "statusChangedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "ShortlistItem_shortlistId_choiceStatus_idx" ON "ShortlistItem"("shortlistId", "choiceStatus");

-- CreateIndex
CREATE INDEX "ShortlistItem_shortlistId_selectionRank_idx" ON "ShortlistItem"("shortlistId", "selectionRank");

-- CreateIndex
CREATE INDEX "ShortlistItem_replacedByShortlistItemId_idx" ON "ShortlistItem"("replacedByShortlistItemId");

-- AddForeignKey
ALTER TABLE "ShortlistItem" ADD CONSTRAINT "ShortlistItem_replacedByShortlistItemId_fkey" FOREIGN KEY ("replacedByShortlistItemId") REFERENCES "ShortlistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
