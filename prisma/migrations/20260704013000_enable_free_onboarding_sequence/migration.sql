-- Activar secuencia free onboarding automática (paso 2 hoy, paso 3 mañana 11:30 AR).
-- Paso 1 queda inactivo; paso 2 = día 0 del diagnóstico; paso 3 = día +1.
UPDATE "free_email_sequences"
SET
  "enabled" = true,
  "send_hour_local" = 11,
  "send_minute_local" = 30,
  "notes" = COALESCE("notes", '') || E'\n[2026-07-04] Activada automática: paso 2 día 0, paso 3 día +1, envío desde 11:30 AR.',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'free_onboarding';

UPDATE "free_email_sequence_steps" AS s
SET "active" = false, "updated_at" = CURRENT_TIMESTAMP
FROM "free_email_sequences" AS seq
WHERE s."sequence_id" = seq."id"
  AND seq."key" = 'free_onboarding'
  AND s."sort_order" = 1;

UPDATE "free_email_sequence_steps" AS s
SET "delay_days_after_previous" = 0, "updated_at" = CURRENT_TIMESTAMP
FROM "free_email_sequences" AS seq
WHERE s."sequence_id" = seq."id"
  AND seq."key" = 'free_onboarding'
  AND s."sort_order" = 2;

UPDATE "free_email_sequence_steps" AS s
SET "delay_days_after_previous" = 1, "updated_at" = CURRENT_TIMESTAMP
FROM "free_email_sequences" AS seq
WHERE s."sequence_id" = seq."id"
  AND seq."key" = 'free_onboarding'
  AND s."sort_order" = 3;
