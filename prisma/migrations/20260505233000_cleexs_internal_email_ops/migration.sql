-- Cleexs interno: campañas de secuencia email + log de envíos (auditoría MVP)

CREATE TYPE "CleexsEmailScoreBucket" AS ENUM ('low', 'mid', 'high', 'all');

CREATE TYPE "CleexsEmailSendStatus" AS ENUM ('pending', 'sent', 'failed', 'skipped');

CREATE TABLE "cleexs_internal_email_campaigns" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "week_index" INTEGER NOT NULL,
    "score_bucket" "CleexsEmailScoreBucket" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "esp_template_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cleexs_internal_email_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cleexs_internal_email_campaigns_slug_key" ON "cleexs_internal_email_campaigns"("slug");

CREATE INDEX "cleexs_internal_email_campaigns_week_index_score_bucket_active_idx" ON "cleexs_internal_email_campaigns"("week_index", "score_bucket", "active");

CREATE TABLE "cleexs_internal_email_send_logs" (
    "id" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "user_id" TEXT,
    "tenant_id" TEXT,
    "campaign_slug" TEXT NOT NULL,
    "score_bucket" TEXT,
    "cleexs_score" INTEGER,
    "merge_summary" JSONB,
    "status" "CleexsEmailSendStatus" NOT NULL,
    "external_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cleexs_internal_email_send_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cleexs_internal_email_send_logs_campaign_slug_created_at_idx" ON "cleexs_internal_email_send_logs"("campaign_slug", "created_at");

CREATE INDEX "cleexs_internal_email_send_logs_recipient_email_created_at_idx" ON "cleexs_internal_email_send_logs"("recipient_email", "created_at");

CREATE INDEX "cleexs_internal_email_send_logs_status_idx" ON "cleexs_internal_email_send_logs"("status");

ALTER TABLE "cleexs_internal_email_send_logs" ADD CONSTRAINT "cleexs_internal_email_send_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cleexs_internal_email_send_logs" ADD CONSTRAINT "cleexs_internal_email_send_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
