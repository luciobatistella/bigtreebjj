-- Preserve every canonical instructor selected by the applicant while keeping
-- the original single-teacher columns compatible with existing submissions.
ALTER TABLE "LineageSubmission"
ADD COLUMN "teacherPersonIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "teacherNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "countryCode" TEXT;

UPDATE "LineageSubmission"
SET
  "teacherPersonIds" = CASE
    WHEN "teacherPersonId" IS NULL THEN ARRAY[]::TEXT[]
    ELSE ARRAY["teacherPersonId"]
  END,
  "teacherNames" = ARRAY["teacherName"];
