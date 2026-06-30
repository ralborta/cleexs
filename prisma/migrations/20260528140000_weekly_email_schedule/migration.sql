-- Singleton de configuracion del cron de emails semanales.
CREATE TABLE IF NOT EXISTS "weekly_email_schedule" (
  "id"              TEXT PRIMARY KEY,
  "key"             TEXT NOT NULL,
  "enabled"         BOOLEAN NOT NULL DEFAULT TRUE,
  "day_of_week_utc" INTEGER NOT NULL DEFAULT 2,
  "hour_utc"        INTEGER NOT NULL DEFAULT 13,
  "segment"         TEXT NOT NULL DEFAULT 'free',
  "dry_run"         BOOLEAN NOT NULL DEFAULT FALSE,
  "notes"           TEXT,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by"      TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_email_schedule_key_key" ON "weekly_email_schedule"("key");

INSERT INTO "weekly_email_schedule"("id", "key", "enabled", "day_of_week_utc", "hour_utc", "segment", "dry_run", "updated_at")
VALUES ('wes-default-0000', 'default', TRUE, 2, 13, 'free', FALSE, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
