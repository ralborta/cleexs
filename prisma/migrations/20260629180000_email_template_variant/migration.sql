-- Variante visual de plantilla por campaña interna (carta vs newsletter editorial).

CREATE TYPE "CleexsEmailTemplateVariant" AS ENUM ('letter', 'editorial');

ALTER TABLE "cleexs_internal_email_campaigns"
ADD COLUMN "template_variant" "CleexsEmailTemplateVariant" NOT NULL DEFAULT 'letter';
