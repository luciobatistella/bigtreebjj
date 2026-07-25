-- Persist the selected graduation path and the submitter's declaration that
-- every certificate they actually received was included.
ALTER TABLE "LineageSubmission"
ADD COLUMN "graduationTrack" TEXT,
ADD COLUMN "certificateCompletenessConfirmed" BOOLEAN NOT NULL DEFAULT false;
