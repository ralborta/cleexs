-- Brand portal: hasta 5 prompts guardados + selección para corridas weekly_portal
CREATE TABLE "brand_portal_saved_prompts" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "prompt_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_portal_saved_prompts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brand_portal_saved_prompts_brand_id_slot_key" ON "brand_portal_saved_prompts"("brand_id", "slot");
CREATE INDEX "brand_portal_saved_prompts_brand_id_idx" ON "brand_portal_saved_prompts"("brand_id");

ALTER TABLE "brand_portal_saved_prompts" ADD CONSTRAINT "brand_portal_saved_prompts_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brands" ADD COLUMN "selected_weekly_portal_prompt_id" TEXT;
CREATE INDEX "brands_selected_weekly_portal_prompt_id_idx" ON "brands"("selected_weekly_portal_prompt_id");
ALTER TABLE "brands" ADD CONSTRAINT "brands_selected_weekly_portal_prompt_id_fkey" FOREIGN KEY ("selected_weekly_portal_prompt_id") REFERENCES "brand_portal_saved_prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "prompts" ADD COLUMN "brand_portal_saved_prompt_id" TEXT;
CREATE UNIQUE INDEX "prompts_brand_portal_saved_prompt_id_key" ON "prompts"("brand_portal_saved_prompt_id");
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_brand_portal_saved_prompt_id_fkey" FOREIGN KEY ("brand_portal_saved_prompt_id") REFERENCES "brand_portal_saved_prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "runs" ADD COLUMN "weekly_portal_saved_prompt_id" TEXT;
CREATE INDEX "runs_weekly_portal_saved_prompt_id_idx" ON "runs"("weekly_portal_saved_prompt_id");
ALTER TABLE "runs" ADD CONSTRAINT "runs_weekly_portal_saved_prompt_id_fkey" FOREIGN KEY ("weekly_portal_saved_prompt_id") REFERENCES "brand_portal_saved_prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
