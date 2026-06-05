-- Selección de país/mercado por corrida (premium elige hasta 5 países distintos).
-- Sella el mercado en cada Run para históricos por país y para alimentar prompts.

ALTER TABLE "runs" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "runs" ADD COLUMN IF NOT EXISTS "geo_market" TEXT;
ALTER TABLE "runs" ADD COLUMN IF NOT EXISTS "country_iso" TEXT;
