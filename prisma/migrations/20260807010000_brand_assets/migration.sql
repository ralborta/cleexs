-- CreateTable
CREATE TABLE "brand_assets" (
    "domain" TEXT NOT NULL,
    "brand_name" TEXT,
    "logo_url" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'missing',
    "confidence" INTEGER,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_assets_pkey" PRIMARY KEY ("domain")
);

-- CreateIndex
CREATE INDEX "brand_assets_status_idx" ON "brand_assets"("status");

-- CreateIndex
CREATE INDEX "brand_assets_checked_at_idx" ON "brand_assets"("checked_at");
