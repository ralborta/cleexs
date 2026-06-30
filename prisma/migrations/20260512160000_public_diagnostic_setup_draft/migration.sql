-- Borrador de setup (competidores sugeridos, etc.) antes de que el usuario confirme e inicie el análisis.
ALTER TABLE "public_diagnostics" ADD COLUMN IF NOT EXISTS "setup_draft_json" JSONB;
