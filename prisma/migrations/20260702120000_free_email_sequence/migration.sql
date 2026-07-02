-- Secuencia free onboarding: config + pasos editables (preview admin).
CREATE TABLE "free_email_sequences" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'free_onboarding',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "send_hour_local" INTEGER NOT NULL DEFAULT 10,
    "send_minute_local" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "notes" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "free_email_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "free_email_sequences_key_key" ON "free_email_sequences"("key");

CREATE TABLE "free_email_sequence_steps" (
    "id" TEXT NOT NULL,
    "sequence_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "delay_days_after_previous" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "preheader" TEXT,
    "body" TEXT,
    "template_variant" "CleexsEmailTemplateVariant" NOT NULL DEFAULT 'letter',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "free_email_sequence_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "free_email_sequence_steps_sequence_id_sort_order_key" ON "free_email_sequence_steps"("sequence_id", "sort_order");
CREATE INDEX "free_email_sequence_steps_sequence_id_sort_order_idx" ON "free_email_sequence_steps"("sequence_id", "sort_order");

ALTER TABLE "free_email_sequence_steps" ADD CONSTRAINT "free_email_sequence_steps_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "free_email_sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
