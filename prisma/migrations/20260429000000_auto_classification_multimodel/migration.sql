-- Auto classification from domain (columnas opcionales, no afecta generacion de resultados)

-- Enums nuevos
DO $$ BEGIN
  CREATE TYPE "BusinessType" AS ENUM ('brand', 'retailer_multibrand', 'distributor', 'importer', 'marketplace', 'service', 'saas', 'unknown');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SizeSegment" AS ENUM ('premium', 'mid', 'value', 'unknown');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Brand: clasificacion automatica (nullable, no rompe filas existentes)
ALTER TABLE "brands"
  ADD COLUMN IF NOT EXISTS "business_type" "BusinessType" DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "subcategory" TEXT,
  ADD COLUMN IF NOT EXISTS "geo_market" TEXT,
  ADD COLUMN IF NOT EXISTS "size_segment" "SizeSegment" DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "auto_detected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "classifier_meta" JSONB;

CREATE INDEX IF NOT EXISTS "brands_domain_idx" ON "brands"("domain");
CREATE INDEX IF NOT EXISTS "brands_business_type_idx" ON "brands"("business_type");

-- Competitor: alineacion con Brand (nullable, no rompe)
ALTER TABLE "competitors"
  ADD COLUMN IF NOT EXISTS "domain" TEXT,
  ADD COLUMN IF NOT EXISTS "business_type" "BusinessType" DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "subcategory" TEXT,
  ADD COLUMN IF NOT EXISTS "geo_market" TEXT,
  ADD COLUMN IF NOT EXISTS "auto_detected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "validated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "discovery_reason" TEXT;

CREATE INDEX IF NOT EXISTS "competitors_domain_idx" ON "competitors"("domain");
