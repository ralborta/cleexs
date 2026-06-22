-- Clics en tarjetas/botones "Desbloquear" del upsell Plan Conquistar (funnel admin).

CREATE TABLE IF NOT EXISTS "unlock_click_events" (
  "id"            TEXT PRIMARY KEY,
  "unlock_key"    TEXT NOT NULL,
  "label"         TEXT NOT NULL,
  "diagnostic_id" TEXT,
  "visitor_id"    TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "unlock_click_events_created_idx" ON "unlock_click_events"("created_at");
CREATE INDEX IF NOT EXISTS "unlock_click_events_key_created_idx" ON "unlock_click_events"("unlock_key", "created_at");
