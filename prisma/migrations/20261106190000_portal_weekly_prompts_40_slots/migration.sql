-- Ampliar contrato de slots de prompts del portal: 0..39 (antes documentado como 0..4).
-- No destructivo: no modifica ni borra filas existentes (slots históricos 0..4 siguen válidos).
-- Rollback: ALTER TABLE "brand_portal_saved_prompts" DROP CONSTRAINT IF EXISTS "brand_portal_saved_prompts_slot_range_check";

ALTER TABLE "brand_portal_saved_prompts"
  DROP CONSTRAINT IF EXISTS "brand_portal_saved_prompts_slot_range_check";

ALTER TABLE "brand_portal_saved_prompts"
  ADD CONSTRAINT "brand_portal_saved_prompts_slot_range_check"
  CHECK (slot >= 0 AND slot <= 39);
