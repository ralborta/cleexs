-- Configuración global clave/valor para feature flags y promociones controladas desde el admin.
-- Ej: toggle del upsell "Plan Conquistar" en la página de resultados (key = 'promo.plan_conquistar_upsell').
-- El valor se guarda como JSONB para soportar toggles con ventana de fechas.

CREATE TABLE IF NOT EXISTS "app_settings" (
  "key"        TEXT PRIMARY KEY,
  "value"      JSONB NOT NULL,
  "updated_by" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
