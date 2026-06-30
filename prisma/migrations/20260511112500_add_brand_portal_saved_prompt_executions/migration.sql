-- Historial de ejecuciones para prompts guardados del portal premium
CREATE TABLE "brand_portal_saved_prompt_executions" (
    "id" TEXT NOT NULL,
    "saved_prompt_id" TEXT NOT NULL,
    "run_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'portal_manual',
    "prompt_text_snapshot" TEXT NOT NULL,
    "response_text" TEXT NOT NULL,
    "analysis_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_portal_saved_prompt_executions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "brand_portal_saved_prompt_executions_saved_prompt_id_created_at_idx"
ON "brand_portal_saved_prompt_executions"("saved_prompt_id", "created_at");

CREATE INDEX "brand_portal_saved_prompt_executions_run_id_idx"
ON "brand_portal_saved_prompt_executions"("run_id");

ALTER TABLE "brand_portal_saved_prompt_executions"
ADD CONSTRAINT "brand_portal_saved_prompt_executions_saved_prompt_id_fkey"
FOREIGN KEY ("saved_prompt_id") REFERENCES "brand_portal_saved_prompts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brand_portal_saved_prompt_executions"
ADD CONSTRAINT "brand_portal_saved_prompt_executions_run_id_fkey"
FOREIGN KEY ("run_id") REFERENCES "runs"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
