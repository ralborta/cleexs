-- Preferencias configurables del portal de marca (JSON por brand)
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "portal_settings" JSONB;
