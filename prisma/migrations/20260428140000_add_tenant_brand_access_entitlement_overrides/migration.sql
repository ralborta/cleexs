-- Acceso marca↔tenant (reportes profundos, upsert post-generación)
-- y overrides de plan por tenant/usuario.

CREATE TABLE IF NOT EXISTS "tenant_brand_access" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "brand_id" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'claim',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_brand_access_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "entitlement_overrides" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT,
  "user_id" TEXT,
  "grant_plan" TEXT NOT NULL,
  "reason" TEXT,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "entitlement_overrides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tenant_brand_access_tenant_id_idx" ON "tenant_brand_access" ("tenant_id");
CREATE INDEX IF NOT EXISTS "tenant_brand_access_brand_id_idx" ON "tenant_brand_access" ("brand_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_brand_access_tenant_id_brand_id_key" ON "tenant_brand_access" ("tenant_id", "brand_id");

CREATE INDEX IF NOT EXISTS "entitlement_overrides_tenant_id_active_starts_at_ends_at_idx" ON "entitlement_overrides" ("tenant_id", "active", "starts_at", "ends_at");
CREATE INDEX IF NOT EXISTS "entitlement_overrides_user_id_active_starts_at_ends_at_idx" ON "entitlement_overrides" ("user_id", "active", "starts_at", "ends_at");

ALTER TABLE "tenant_brand_access" DROP CONSTRAINT IF EXISTS "tenant_brand_access_tenant_id_fkey";
ALTER TABLE "tenant_brand_access"
  ADD CONSTRAINT "tenant_brand_access_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_brand_access" DROP CONSTRAINT IF EXISTS "tenant_brand_access_brand_id_fkey";
ALTER TABLE "tenant_brand_access"
  ADD CONSTRAINT "tenant_brand_access_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "entitlement_overrides" DROP CONSTRAINT IF EXISTS "entitlement_overrides_tenant_id_fkey";
ALTER TABLE "entitlement_overrides"
  ADD CONSTRAINT "entitlement_overrides_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "entitlement_overrides" DROP CONSTRAINT IF EXISTS "entitlement_overrides_user_id_fkey";
ALTER TABLE "entitlement_overrides"
  ADD CONSTRAINT "entitlement_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
