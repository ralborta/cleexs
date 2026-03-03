-- CreateEnum
CREATE TYPE "RunSchedule" AS ENUM ('semanal', 'quincenal', 'mensual');

-- AlterTable
ALTER TABLE "brands" ADD COLUMN "run_schedule" "RunSchedule";

-- CreateIndex
CREATE INDEX "brands_run_schedule_idx" ON "brands"("run_schedule");
