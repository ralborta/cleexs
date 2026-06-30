-- AlterTable
ALTER TABLE "public_diagnostics" ADD COLUMN "share_slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "public_diagnostics_share_slug_key" ON "public_diagnostics"("share_slug");

-- CreateTable
CREATE TABLE "public_diagnostic_share_visits" (
    "id" TEXT NOT NULL,
    "diagnostic_id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_diagnostic_share_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_diagnostic_share_visits_diagnostic_id_visitor_id_key" ON "public_diagnostic_share_visits"("diagnostic_id", "visitor_id");

-- CreateIndex
CREATE INDEX "public_diagnostic_share_visits_diagnostic_id_idx" ON "public_diagnostic_share_visits"("diagnostic_id");

-- AddForeignKey
ALTER TABLE "public_diagnostic_share_visits" ADD CONSTRAINT "public_diagnostic_share_visits_diagnostic_id_fkey" FOREIGN KEY ("diagnostic_id") REFERENCES "public_diagnostics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
