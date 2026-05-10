/*
  Warnings:

  - You are about to drop the `environments_physical` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `environments_sim` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "environments_physical";

-- DropTable
DROP TABLE "environments_sim";

-- CreateTable
CREATE TABLE "compatibility_edges" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "search_text" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((((((((COALESCE((data ->> 'name'::text), ''::text) || ' '::text) || COALESCE((data ->> 'description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'task_description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'manufacturer'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'author'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'slug'::text), ''::text)))) STORED,

    CONSTRAINT "compatibility_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environments" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "search_text" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((((((((COALESCE((data ->> 'name'::text), ''::text) || ' '::text) || COALESCE((data ->> 'description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'task_description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'manufacturer'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'author'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'slug'::text), ''::text)))) STORED,

    CONSTRAINT "environments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compatibility_edges_slug_key" ON "compatibility_edges"("slug");

-- CreateIndex
CREATE INDEX "idx_compatibility_edges_data" ON "compatibility_edges" USING GIN ("data");

-- CreateIndex
CREATE INDEX "idx_compatibility_edges_search" ON "compatibility_edges" USING GIN ("search_text");

-- CreateIndex
CREATE UNIQUE INDEX "environments_slug_key" ON "environments"("slug");

-- CreateIndex
CREATE INDEX "idx_environments_data" ON "environments" USING GIN ("data");

-- CreateIndex
CREATE INDEX "idx_environments_search" ON "environments" USING GIN ("search_text");
