-- Canal WhatsApp (QR YouTube/TV): atribución y límites por teléfono
ALTER TABLE "public_diagnostics"
ADD COLUMN "source_channel" TEXT,
ADD COLUMN "wa_phone" TEXT;

CREATE INDEX "public_diagnostics_source_channel_idx" ON "public_diagnostics"("source_channel");
CREATE INDEX "public_diagnostics_wa_phone_created_at_idx" ON "public_diagnostics"("wa_phone", "created_at");
