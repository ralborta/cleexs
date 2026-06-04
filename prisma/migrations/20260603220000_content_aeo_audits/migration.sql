-- J102 — Análisis + Reescritura AEO: herramienta standalone de venta única.
-- Servicio separado de la Auditoría Agéntica. Analiza el CONTENIDO del sitio
-- con un LLM y entrega diagnóstico por dimensiones + landing reescrita + queries.

CREATE TABLE IF NOT EXISTS "content_aeo_audits" (
  "id"            TEXT PRIMARY KEY,
  "slug"          TEXT NOT NULL,
  "target_url"    TEXT NOT NULL,
  "site_label"    TEXT,
  "industry"      TEXT,
  "region"        TEXT,
  "brand_id"      TEXT,
  "client_email"  TEXT,
  "status"        TEXT NOT NULL DEFAULT 'pending',
  "score_before"  INTEGER,
  "score_after"   INTEGER,
  "result_json"   JSONB,
  "model"         TEXT,
  "error"         TEXT,
  "paid_at"       TIMESTAMP(3),
  "delivered_at"  TIMESTAMP(3),
  "notes"         TEXT,
  "created_by"    TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "content_aeo_audits_slug_unique" ON "content_aeo_audits"("slug");
CREATE INDEX IF NOT EXISTS "content_aeo_audits_status_idx" ON "content_aeo_audits"("status");
CREATE INDEX IF NOT EXISTS "content_aeo_audits_brand_id_idx" ON "content_aeo_audits"("brand_id");
CREATE INDEX IF NOT EXISTS "content_aeo_audits_created_at_idx" ON "content_aeo_audits"("created_at");
