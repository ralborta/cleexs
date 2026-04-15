-- Tracking de embajadores/UTM para diagnóstico público
ALTER TABLE "public_diagnostics"
ADD COLUMN "ref_code" TEXT,
ADD COLUMN "utm_source" TEXT,
ADD COLUMN "utm_medium" TEXT,
ADD COLUMN "utm_campaign" TEXT;

CREATE INDEX "public_diagnostics_ref_code_idx" ON "public_diagnostics"("ref_code");
CREATE INDEX "public_diagnostics_utm_source_idx" ON "public_diagnostics"("utm_source");
