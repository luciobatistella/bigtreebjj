-- Ordered, private documentary journey from white/youth belts through black.
-- Legacy single-certificate columns remain temporarily for backward compatibility.
CREATE TABLE "LineageSubmissionCertificate" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "beltRank" TEXT NOT NULL,
    "beltLabel" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "awardedAt" TIMESTAMP(3),
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineageSubmissionCertificate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LineageSubmissionCertificate_submissionId_sequence_idx"
ON "LineageSubmissionCertificate"("submissionId", "sequence");

ALTER TABLE "LineageSubmissionCertificate"
ADD CONSTRAINT "LineageSubmissionCertificate_submissionId_fkey"
FOREIGN KEY ("submissionId") REFERENCES "LineageSubmission"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
