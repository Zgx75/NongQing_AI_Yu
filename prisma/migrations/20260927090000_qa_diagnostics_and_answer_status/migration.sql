ALTER TABLE "QaMessage" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "QaMessage" ADD COLUMN "executionStatus" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "QaMessage" ADD COLUMN "answerStatus" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "QaMessage" ADD COLUMN "groundingStatus" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "QaMessage" ADD COLUMN "disclaimer" TEXT NOT NULL DEFAULT '';
ALTER TABLE "QaMessage" ADD COLUMN "searchDiagnosticsJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "QaMessage" ADD COLUMN "failureStage" TEXT;
