-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "benchmarks" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "search_text" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((((((((COALESCE((data ->> 'name'::text), ''::text) || ' '::text) || COALESCE((data ->> 'description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'task_description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'manufacturer'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'author'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'slug'::text), ''::text)))) STORED,

    CONSTRAINT "benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "datasets" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "search_text" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((((((((COALESCE((data ->> 'name'::text), ''::text) || ' '::text) || COALESCE((data ->> 'description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'task_description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'manufacturer'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'author'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'slug'::text), ''::text)))) STORED,

    CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deploy_notes" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "search_text" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((((((((COALESCE((data ->> 'name'::text), ''::text) || ' '::text) || COALESCE((data ->> 'description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'task_description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'manufacturer'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'author'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'slug'::text), ''::text)))) STORED,

    CONSTRAINT "deploy_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "search_text" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((((((((COALESCE((data ->> 'name'::text), ''::text) || ' '::text) || COALESCE((data ->> 'description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'task_description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'manufacturer'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'author'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'slug'::text), ''::text)))) STORED,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "robots" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "search_text" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((((((((COALESCE((data ->> 'name'::text), ''::text) || ' '::text) || COALESCE((data ->> 'description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'task_description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'manufacturer'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'author'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'slug'::text), ''::text)))) STORED,

    CONSTRAINT "robots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "name" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environments_physical" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "search_text" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((((((((COALESCE((data ->> 'name'::text), ''::text) || ' '::text) || COALESCE((data ->> 'description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'task_description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'manufacturer'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'author'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'slug'::text), ''::text)))) STORED,

    CONSTRAINT "environments_physical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environments_sim" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "search_text" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((((((((COALESCE((data ->> 'name'::text), ''::text) || ' '::text) || COALESCE((data ->> 'description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'task_description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'manufacturer'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'author'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'slug'::text), ''::text)))) STORED,

    CONSTRAINT "environments_sim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hardware" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "search_text" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((((((((COALESCE((data ->> 'name'::text), ''::text) || ' '::text) || COALESCE((data ->> 'description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'task_description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'manufacturer'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'author'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'slug'::text), ''::text)))) STORED,

    CONSTRAINT "hardware_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "papers" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "search_text" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((((((((COALESCE((data ->> 'name'::text), ''::text) || ' '::text) || COALESCE((data ->> 'description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'task_description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'manufacturer'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'author'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'slug'::text), ''::text)))) STORED,

    CONSTRAINT "papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "search_text" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((((((((COALESCE((data ->> 'name'::text), ''::text) || ' '::text) || COALESCE((data ->> 'description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'task_description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'manufacturer'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'author'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'slug'::text), ''::text)))) STORED,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "benchmarks_slug_key" ON "benchmarks"("slug");

-- CreateIndex
CREATE INDEX "idx_benchmarks_data" ON "benchmarks" USING GIN ("data");

-- CreateIndex
CREATE INDEX "idx_benchmarks_search" ON "benchmarks" USING GIN ("search_text");

-- CreateIndex
CREATE UNIQUE INDEX "datasets_slug_key" ON "datasets"("slug");

-- CreateIndex
CREATE INDEX "idx_datasets_data" ON "datasets" USING GIN ("data");

-- CreateIndex
CREATE INDEX "idx_datasets_search" ON "datasets" USING GIN ("search_text");

-- CreateIndex
CREATE UNIQUE INDEX "deploy_notes_slug_key" ON "deploy_notes"("slug");

-- CreateIndex
CREATE INDEX "idx_deploy_notes_data" ON "deploy_notes" USING GIN ("data");

-- CreateIndex
CREATE INDEX "idx_deploy_notes_search" ON "deploy_notes" USING GIN ("search_text");

-- CreateIndex
CREATE UNIQUE INDEX "policies_slug_key" ON "policies"("slug");

-- CreateIndex
CREATE INDEX "idx_policies_data" ON "policies" USING GIN ("data");

-- CreateIndex
CREATE INDEX "idx_policies_search" ON "policies" USING GIN ("search_text");

-- CreateIndex
CREATE UNIQUE INDEX "robots_slug_key" ON "robots"("slug");

-- CreateIndex
CREATE INDEX "idx_robots_data" ON "robots" USING GIN ("data");

-- CreateIndex
CREATE INDEX "idx_robots_search" ON "robots" USING GIN ("search_text");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "idx_api_keys_user_id" ON "api_keys"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "environments_physical_slug_key" ON "environments_physical"("slug");

-- CreateIndex
CREATE INDEX "idx_environments_physical_data" ON "environments_physical" USING GIN ("data");

-- CreateIndex
CREATE INDEX "idx_environments_physical_search" ON "environments_physical" USING GIN ("search_text");

-- CreateIndex
CREATE UNIQUE INDEX "environments_sim_slug_key" ON "environments_sim"("slug");

-- CreateIndex
CREATE INDEX "idx_environments_sim_data" ON "environments_sim" USING GIN ("data");

-- CreateIndex
CREATE INDEX "idx_environments_sim_search" ON "environments_sim" USING GIN ("search_text");

-- CreateIndex
CREATE UNIQUE INDEX "hardware_slug_key" ON "hardware"("slug");

-- CreateIndex
CREATE INDEX "idx_hardware_data" ON "hardware" USING GIN ("data");

-- CreateIndex
CREATE INDEX "idx_hardware_search" ON "hardware" USING GIN ("search_text");

-- CreateIndex
CREATE UNIQUE INDEX "papers_slug_key" ON "papers"("slug");

-- CreateIndex
CREATE INDEX "idx_papers_data" ON "papers" USING GIN ("data");

-- CreateIndex
CREATE INDEX "idx_papers_search" ON "papers" USING GIN ("search_text");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_slug_key" ON "tasks"("slug");

-- CreateIndex
CREATE INDEX "idx_tasks_data" ON "tasks" USING GIN ("data");

-- CreateIndex
CREATE INDEX "idx_tasks_search" ON "tasks" USING GIN ("search_text");

