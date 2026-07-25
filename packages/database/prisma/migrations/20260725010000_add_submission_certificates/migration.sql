-- Private certificate metadata for review-first community submissions.
-- The binary itself remains in private application storage and is never
-- exposed through public lineage endpoints.
ALTER TABLE "LineageSubmission"
ADD COLUMN "certificateOriginalName" TEXT,
ADD COLUMN "certificateMimeType" TEXT,
ADD COLUMN "certificateSize" INTEGER,
ADD COLUMN "certificateStoragePath" TEXT,
ADD COLUMN "certificateSha256" TEXT;
