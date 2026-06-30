-- Integraciones Google (GA4 + Search Console).
-- Solo se usan para clientes Premium (planes crecimiento/enterprise).
-- El cliente autoriza vía OAuth desde su portal; guardamos el refresh_token cifrado AES-256-GCM.

-- Tabla principal: una integración OAuth por tenant.
CREATE TABLE IF NOT EXISTS "google_integrations" (
  "id"                       TEXT PRIMARY KEY,
  "tenant_id"                TEXT NOT NULL UNIQUE,
  "google_email"             TEXT NOT NULL,
  "google_user_id"           TEXT,
  "refresh_token_encrypted"  TEXT NOT NULL,
  "scopes_granted"           TEXT NOT NULL,
  "status"                   TEXT NOT NULL DEFAULT 'active',
  "last_error_message"       TEXT,
  "last_error_at"            TIMESTAMP(3),
  "connected_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "google_integrations_status_idx" ON "google_integrations"("status");

-- Propiedad GA4 (y opcional GSC) elegida para una brand específica.
CREATE TABLE IF NOT EXISTS "google_analytics_properties" (
  "id"                 TEXT PRIMARY KEY,
  "integration_id"     TEXT NOT NULL,
  "brand_id"           TEXT NOT NULL UNIQUE,
  "ga4_property_id"    TEXT NOT NULL,
  "ga4_property_name"  TEXT,
  "gsc_site_url"       TEXT,
  "last_sync_at"       TIMESTAMP(3),
  "last_sync_status"   TEXT,
  "last_sync_error"    TEXT,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "google_analytics_properties_integration_fk"
    FOREIGN KEY ("integration_id") REFERENCES "google_integrations"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "google_analytics_properties_integration_idx" ON "google_analytics_properties"("integration_id");

-- Snapshot diario por brand + fuente IA. Lo poblamos con un job cada ~6 horas.
CREATE TABLE IF NOT EXISTS "ai_traffic_snapshots" (
  "id"                TEXT PRIMARY KEY,
  "property_id"       TEXT NOT NULL,
  "brand_id"          TEXT NOT NULL,
  "date"              DATE NOT NULL,
  "ai_source"         TEXT NOT NULL,
  "sessions"          INTEGER NOT NULL DEFAULT 0,
  "total_users"       INTEGER NOT NULL DEFAULT 0,
  "new_users"         INTEGER NOT NULL DEFAULT 0,
  "conversions"       INTEGER NOT NULL DEFAULT 0,
  "engaged_sessions"  INTEGER NOT NULL DEFAULT 0,
  "bounce_rate"       DOUBLE PRECISION,
  "top_landing_page"  TEXT,
  "raw_json"          JSONB,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_traffic_snapshots_property_fk"
    FOREIGN KEY ("property_id") REFERENCES "google_analytics_properties"("id") ON DELETE CASCADE,
  CONSTRAINT "ai_traffic_snapshots_unique_per_day"
    UNIQUE ("brand_id", "date", "ai_source")
);

CREATE INDEX IF NOT EXISTS "ai_traffic_snapshots_brand_date_idx"    ON "ai_traffic_snapshots"("brand_id", "date");
CREATE INDEX IF NOT EXISTS "ai_traffic_snapshots_property_date_idx" ON "ai_traffic_snapshots"("property_id", "date");
