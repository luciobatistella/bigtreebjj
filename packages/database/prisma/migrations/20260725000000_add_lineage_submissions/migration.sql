-- Public, review-first requests to join the lineage tree.
-- These records are intentionally separate from Person and LineageClaim so
-- unreviewed community submissions never appear in the public forest.
CREATE TABLE "LineageSubmission" (
    "id" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "instagram" TEXT,
    "teacherPersonId" TEXT,
    "teacherName" TEXT NOT NULL,
    "academyTeam" TEXT,
    "city" TEXT,
    "country" TEXT,
    "promotionDate" TIMESTAMP(3),
    "claimType" TEXT NOT NULL DEFAULT 'black_belt_awarded_by',
    "evidenceUrls" TEXT[],
    "evidenceNotes" TEXT,
    "consent" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "personId" TEXT,
    "lineageClaimId" TEXT,
    "reviewerNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineageSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LineageSubmission_protocol_key" ON "LineageSubmission"("protocol");
CREATE INDEX "LineageSubmission_status_createdAt_idx" ON "LineageSubmission"("status", "createdAt");
