-- AlterTable
ALTER TABLE "SourceConfig" ADD COLUMN "allowWrites" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ActionLog" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionLog_viewId_idx" ON "ActionLog"("viewId");
