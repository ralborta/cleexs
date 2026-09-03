-- Revertir activación errónea de 20260704: solo paso 1 al completar diagnóstico.
-- Pasos 2+ quedan inactivos; el cron de secuencia deshabilitado hasta activarlo en admin.
UPDATE "free_email_sequences"
SET
  "enabled" = false,
  "notes" = COALESCE("notes", '') || E'\n[2026-07-20] Cron desactivado; paso 1 solo al completar diagnóstico. Pasos 2+ inactivos.',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'free_onboarding';

UPDATE "free_email_sequence_steps" AS s
SET "active" = true, "updated_at" = CURRENT_TIMESTAMP
FROM "free_email_sequences" AS seq
WHERE s."sequence_id" = seq."id"
  AND seq."key" = 'free_onboarding'
  AND s."sort_order" = 1;

UPDATE "free_email_sequence_steps" AS s
SET "active" = false, "updated_at" = CURRENT_TIMESTAMP
FROM "free_email_sequences" AS seq
WHERE s."sequence_id" = seq."id"
  AND seq."key" = 'free_onboarding'
  AND s."sort_order" > 1;
