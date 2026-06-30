-- Campañas de referidores / auspiciadores y clicks reales de links cortos.
CREATE TABLE "referral_campaigns" (
    "id" TEXT NOT NULL,
    "ref_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "referral_clicks" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "ref_code" TEXT NOT NULL,
    "target_url" TEXT NOT NULL,
    "ip_hash" TEXT,
    "user_agent_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_clicks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_campaigns_ref_code_key" ON "referral_campaigns"("ref_code");
CREATE INDEX "referral_campaigns_active_idx" ON "referral_campaigns"("active");
CREATE INDEX "referral_campaigns_created_at_idx" ON "referral_campaigns"("created_at");
CREATE INDEX "referral_clicks_campaign_id_idx" ON "referral_clicks"("campaign_id");
CREATE INDEX "referral_clicks_ref_code_idx" ON "referral_clicks"("ref_code");
CREATE INDEX "referral_clicks_created_at_idx" ON "referral_clicks"("created_at");

ALTER TABLE "referral_clicks"
ADD CONSTRAINT "referral_clicks_campaign_id_fkey"
FOREIGN KEY ("campaign_id") REFERENCES "referral_campaigns"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
