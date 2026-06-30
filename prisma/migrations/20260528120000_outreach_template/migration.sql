-- Plantilla editable de cold outreach (singleton key='default').
CREATE TABLE IF NOT EXISTS "outreach_templates" (
  "id"          TEXT PRIMARY KEY,
  "key"         TEXT NOT NULL DEFAULT 'default',
  "subject"     TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "use_ai"      BOOLEAN NOT NULL DEFAULT false,
  "updated_by"  TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "outreach_templates_key_key"
  ON "outreach_templates" ("key");

-- Seed con la plantilla por defecto que ya estaba hardcodeada en leads.ts.
INSERT INTO "outreach_templates" ("id", "key", "subject", "body", "use_ai")
VALUES (
  'tpl-default-outreach-0000',
  'default',
  '{{competitorName}} rankea mejor que {{brandName}} en ChatGPT',
  E'Hola,\n\nDetectamos que {{competitorName}} aparece recomendado por encima de {{brandName}} en ChatGPT.\nEn uno de los prompts relevantes, el Top 3 fue:\n{{top3}}\n\nPodemos compartirte un reporte gratuito (código CLEEXS) con evidencia completa y acciones para mejorar.\n\n¿Te interesa que te lo enviemos?\n\n– Cleexs',
  false
)
ON CONFLICT ("key") DO NOTHING;
