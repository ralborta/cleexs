-- Mini-CMS interno de textos editables (sobrescriben defaults hardcodeados).
-- El frontend usa helper t(key, defaultValue) que cae al default si no hay row para esa key+locale.
-- Multi-idioma silencioso: por ahora solo se carga 'es', pero el schema soporta 'en' y 'pt'.

CREATE TABLE IF NOT EXISTS "app_strings" (
  "id"          TEXT PRIMARY KEY,
  "key"         TEXT NOT NULL,
  "locale"      TEXT NOT NULL DEFAULT 'es',
  "value"       TEXT NOT NULL,
  "notes"       TEXT,
  "updated_by"  TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "app_strings_key_locale_unique" ON "app_strings"("key", "locale");
CREATE INDEX IF NOT EXISTS "app_strings_locale_idx" ON "app_strings"("locale");
