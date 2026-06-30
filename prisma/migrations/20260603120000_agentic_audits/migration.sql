-- J101 — Auditoría Agéntica: herramienta standalone de venta única.
-- El admin crea una auditoría para la URL de un cliente, corre el análisis de
-- legibilidad para agentes de IA, y entrega un link público con el informe.

CREATE TABLE IF NOT EXISTS "agentic_audits" (
  "id"            TEXT PRIMARY KEY,
  "slug"          TEXT NOT NULL,
  "target_url"    TEXT NOT NULL,
  "site_label"    TEXT,
  "brand_id"      TEXT,
  "client_email"  TEXT,
  "status"        TEXT NOT NULL DEFAULT 'pending',
  "overall_score" INTEGER,
  "result_json"   JSONB,
  "error"         TEXT,
  "paid_at"       TIMESTAMP(3),
  "delivered_at"  TIMESTAMP(3),
  "notes"         TEXT,
  "created_by"    TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "agentic_audits_slug_unique" ON "agentic_audits"("slug");
CREATE INDEX IF NOT EXISTS "agentic_audits_status_idx" ON "agentic_audits"("status");
CREATE INDEX IF NOT EXISTS "agentic_audits_brand_id_idx" ON "agentic_audits"("brand_id");
CREATE INDEX IF NOT EXISTS "agentic_audits_created_at_idx" ON "agentic_audits"("created_at");
