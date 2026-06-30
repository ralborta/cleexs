-- Libro de uso para límites de plan (score_view, report_deep_generate, etc.).
-- Sin esta tabla, el dashboard puede cargar para cuentas admin (bypass),
-- pero falla al generar reporte profundo (consumeEntitlement).

DO $$
BEGIN
  CREATE TYPE "EntitlementAction" AS ENUM (
    'score_view',
    'score_generate',
    'report_deep_generate',
    'report_deep_view',
    'profile_claim'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "UsageActorType" AS ENUM ('anonymous', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "usage_ledger" (
  "id" TEXT NOT NULL,
  "action" "EntitlementAction" NOT NULL,
  "actor_type" "UsageActorType" NOT NULL,
  "anonymous_id" TEXT,
  "user_id" TEXT,
  "tenant_id" TEXT,
  "brand_id" TEXT,
  "public_diagnostic_id" TEXT,
  "profile_slug" TEXT,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "dedupe_key" TEXT,
  "meta_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "usage_ledger_dedupe_key_key" ON "usage_ledger" ("dedupe_key");
CREATE INDEX IF NOT EXISTS "usage_ledger_action_period_start_period_end_idx" ON "usage_ledger" ("action", "period_start", "period_end");
CREATE INDEX IF NOT EXISTS "usage_ledger_actor_type_anonymous_id_period_start_idx" ON "usage_ledger" ("actor_type", "anonymous_id", "period_start");
CREATE INDEX IF NOT EXISTS "usage_ledger_user_id_period_start_idx" ON "usage_ledger" ("user_id", "period_start");
CREATE INDEX IF NOT EXISTS "usage_ledger_tenant_id_period_start_idx" ON "usage_ledger" ("tenant_id", "period_start");
CREATE INDEX IF NOT EXISTS "usage_ledger_brand_id_idx" ON "usage_ledger" ("brand_id");

ALTER TABLE "usage_ledger" DROP CONSTRAINT IF EXISTS "usage_ledger_user_id_fkey";
ALTER TABLE "usage_ledger"
  ADD CONSTRAINT "usage_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "usage_ledger" DROP CONSTRAINT IF EXISTS "usage_ledger_tenant_id_fkey";
ALTER TABLE "usage_ledger"
  ADD CONSTRAINT "usage_ledger_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "usage_ledger" DROP CONSTRAINT IF EXISTS "usage_ledger_brand_id_fkey";
ALTER TABLE "usage_ledger"
  ADD CONSTRAINT "usage_ledger_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "usage_ledger" DROP CONSTRAINT IF EXISTS "usage_ledger_public_diagnostic_id_fkey";
ALTER TABLE "usage_ledger"
  ADD CONSTRAINT "usage_ledger_public_diagnostic_id_fkey" FOREIGN KEY ("public_diagnostic_id") REFERENCES "public_diagnostics" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
