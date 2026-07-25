-- CreateTable
CREATE TABLE "ExternalSourceProfile" (
    "id" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "source_profile_url" TEXT NOT NULL,
    "external_name" TEXT NOT NULL,
    "nickname" TEXT,
    "listed_team_text" TEXT,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "source_status" TEXT NOT NULL,
    "raw_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalSourceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalProfileSnapshot" (
    "id" TEXT NOT NULL,
    "external_profile_id" TEXT NOT NULL,
    "source_profile_url" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "raw_hash" TEXT NOT NULL,
    "parsed_payload" TEXT NOT NULL,
    "source_status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalProfileSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalFactCandidate" (
    "id" TEXT NOT NULL,
    "external_profile_id" TEXT NOT NULL,
    "candidate_type" TEXT NOT NULL,
    "subject_name" TEXT NOT NULL,
    "object_name" TEXT,
    "structured_value" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_locator" TEXT NOT NULL,
    "evidence_level" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalFactCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlRun" (
    "id" TEXT NOT NULL,
    "connector_name" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dry_run" BOOLEAN NOT NULL DEFAULT false,
    "catalog_discovered" INTEGER NOT NULL DEFAULT 0,
    "profiles_queued" INTEGER NOT NULL DEFAULT 0,
    "profiles_fetched" INTEGER NOT NULL DEFAULT 0,
    "profiles_skipped" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "CrawlRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlLog" (
    "id" TEXT NOT NULL,
    "crawl_run_id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawlLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalSourceProfile_source_profile_url_key" ON "ExternalSourceProfile"("source_profile_url");

-- AddForeignKey
ALTER TABLE "ExternalProfileSnapshot" ADD CONSTRAINT "ExternalProfileSnapshot_external_profile_id_fkey" FOREIGN KEY ("external_profile_id") REFERENCES "ExternalSourceProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalFactCandidate" ADD CONSTRAINT "ExternalFactCandidate_external_profile_id_fkey" FOREIGN KEY ("external_profile_id") REFERENCES "ExternalSourceProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawlLog" ADD CONSTRAINT "CrawlLog_crawl_run_id_fkey" FOREIGN KEY ("crawl_run_id") REFERENCES "CrawlRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
