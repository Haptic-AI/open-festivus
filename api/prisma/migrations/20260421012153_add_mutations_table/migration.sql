-- CreateTable
CREATE TABLE "mutations" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "table_name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "field_path" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_email" TEXT,
    "reason" TEXT,
    "patch" JSONB NOT NULL,
    "old_values" JSONB NOT NULL,
    "new_values" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_note" TEXT,

    CONSTRAINT "mutations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_mutations_table_slug" ON "mutations"("table_name", "slug");

-- CreateIndex
CREATE INDEX "idx_mutations_status" ON "mutations"("status");

-- CreateIndex
CREATE INDEX "idx_mutations_created_at" ON "mutations"("created_at");

-- CreateIndex
CREATE INDEX "idx_mutations_actor_id" ON "mutations"("actor_id");
