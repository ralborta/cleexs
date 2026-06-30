-- Tier para diagnóstico: freemium (solo OpenAI) vs gold (OpenAI + Gemini)
ALTER TABLE "public_diagnostics" ADD COLUMN IF NOT EXISTS "tier" TEXT DEFAULT 'freemium';
