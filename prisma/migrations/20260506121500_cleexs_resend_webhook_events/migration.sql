-- CreateTable
CREATE TABLE "cleexs_resend_webhook_events" (
    "id" TEXT NOT NULL,
    "svix_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "email_id" TEXT,
    "recipient_email" TEXT,
    "occurred_at" TIMESTAMP(3),
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cleexs_resend_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cleexs_resend_webhook_events_svix_id_key" ON "cleexs_resend_webhook_events"("svix_id");

-- CreateIndex
CREATE INDEX "cleexs_resend_webhook_events_event_type_occurred_at_idx" ON "cleexs_resend_webhook_events"("event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "cleexs_resend_webhook_events_email_id_idx" ON "cleexs_resend_webhook_events"("email_id");

-- CreateIndex
CREATE INDEX "cleexs_resend_webhook_events_occurred_at_idx" ON "cleexs_resend_webhook_events"("occurred_at");
