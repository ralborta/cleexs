-- Runs adicionales para diagnóstico gold: mismos prompts ejecutados con Perplexity y Claude vía OpenRouter.
-- Mismo patrón que `run_gemini_id`: solo guardamos el Run.id; el status se deriva del Run asociado.
ALTER TABLE "public_diagnostics" ADD COLUMN IF NOT EXISTS "run_perplexity_id" TEXT;
ALTER TABLE "public_diagnostics" ADD COLUMN IF NOT EXISTS "run_claude_id" TEXT;
