-- Tracking interno del funnel de conversión (dashboard admin "Métricas de Conversión").

-- Visitas a la landing/app (denominador del funnel). Anónimo.
CREATE TABLE IF NOT EXISTS "page_views" (
  "id"             TEXT PRIMARY KEY,
  "path"           TEXT NOT NULL,
  "visitor_id"     TEXT,
  "ref_code"       TEXT,
  "utm_source"     TEXT,
  "utm_medium"     TEXT,
  "utm_campaign"   TEXT,
  "source_channel" TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "page_views_created_idx"      ON "page_views"("created_at");
CREATE INDEX IF NOT EXISTS "page_views_path_created_idx" ON "page_views"("path", "created_at");

-- Clicks en botones de compartir el Cleexs Score, por canal.
CREATE TABLE IF NOT EXISTS "share_events" (
  "id"            TEXT PRIMARY KEY,
  "channel"       TEXT NOT NULL,
  "diagnostic_id" TEXT,
  "share_slug"    TEXT,
  "visitor_id"    TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "share_events_created_idx"         ON "share_events"("created_at");
CREATE INDEX IF NOT EXISTS "share_events_channel_created_idx" ON "share_events"("channel", "created_at");

-- Atribución de adquisición en la compra (suscripción).
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "ref_code"       TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "utm_source"     TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "utm_medium"     TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "utm_campaign"   TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "source_channel" TEXT;
