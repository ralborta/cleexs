-- Contenido editable de campanias internas (subject/body/preheader).
ALTER TABLE "cleexs_internal_email_campaigns"
  ADD COLUMN IF NOT EXISTS "subject"   TEXT,
  ADD COLUMN IF NOT EXISTS "body"      TEXT,
  ADD COLUMN IF NOT EXISTS "preheader" TEXT;
