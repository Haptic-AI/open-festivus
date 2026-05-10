-- Spec 029: attribution foundation. Add nullable FKs from api_keys.owner_id
-- and mutations.author_id to users.id. Both FKs are SET NULL on delete so
-- audit trail survives user removal. Indexes support profile lookups and
-- per-user moderation queries.
--
-- Two spurious ALTERs that Prisma migrate dev drafted (DROP DEFAULT on
-- laundry_compat_edges.search_text, DROP DEFAULT on workbench_projects.updated_at)
-- were removed. They're drift artifacts from features Prisma cannot fully
-- model (tsvector generated column, @updatedAt). Out of scope for spec 029.

-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "owner_id" TEXT;

-- AlterTable
ALTER TABLE "mutations" ADD COLUMN     "author_id" TEXT;

-- CreateIndex
CREATE INDEX "idx_api_keys_owner_id" ON "api_keys"("owner_id");

-- CreateIndex
CREATE INDEX "idx_mutations_author_id_created_at" ON "mutations"("author_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mutations" ADD CONSTRAINT "mutations_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
