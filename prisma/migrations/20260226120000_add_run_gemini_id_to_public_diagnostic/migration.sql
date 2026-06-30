-- Run Gemini: mismo diagnóstico ejecutado con Gemini para score y métricas por modelo
ALTER TABLE "public_diagnostics" ADD COLUMN IF NOT EXISTS "run_gemini_id" TEXT;
