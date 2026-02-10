-- CreateTable
CREATE TABLE "public_diagnostics" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_diagnostics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_diagnostics_domain_key" ON "public_diagnostics"("domain");

-- CreateIndex
CREATE INDEX "public_diagnostics_domain_idx" ON "public_diagnostics"("domain");

-- CreateIndex
CREATE INDEX "public_diagnostics_status_idx" ON "public_diagnostics"("status");
