-- Portal cliente: programa de referidos (?ref=, conteo, recompensa al llegar al objetivo)

ALTER TABLE "tenants" ADD COLUMN "referral_slug" TEXT;
ALTER TABLE "tenants" ADD COLUMN "referred_by_tenant_id" TEXT;
ALTER TABLE "tenants" ADD COLUMN "referral_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tenants" ADD COLUMN "referral_reward_at" TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN "referral_upsell_dismissed_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "tenants_referral_slug_key" ON "tenants"("referral_slug");

CREATE INDEX "tenants_referred_by_tenant_id_idx" ON "tenants"("referred_by_tenant_id");

ALTER TABLE "tenants" ADD CONSTRAINT "tenants_referred_by_tenant_id_fkey" FOREIGN KEY ("referred_by_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
