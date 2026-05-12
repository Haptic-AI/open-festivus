-- CreateEnum
CREATE TYPE "SimulationStatus" AS ENUM ('pending', 'running', 'done', 'failed');

-- CreateTable
CREATE TABLE "simulations" (
    "id" TEXT NOT NULL,
    "hf_url" TEXT NOT NULL,
    "env_slug" TEXT NOT NULL,
    "policy_slug" TEXT,
    "task_slug" TEXT,
    "oneclick_job_id" TEXT,
    "status" "SimulationStatus" NOT NULL DEFAULT 'pending',
    "video_url" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "simulations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_simulations_status" ON "simulations"("status");

-- CreateIndex
CREATE INDEX "idx_simulations_created_at" ON "simulations"("created_at");

-- CreateIndex
CREATE INDEX "idx_simulations_env_slug" ON "simulations"("env_slug");
