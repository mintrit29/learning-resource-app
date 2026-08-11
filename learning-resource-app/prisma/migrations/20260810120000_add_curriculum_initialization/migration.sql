ALTER TABLE "User" ADD COLUMN "curriculumInitializedAt" DATETIME;
ALTER TABLE "Tag" ADD COLUMN "isClassificationEnabled" BOOLEAN NOT NULL DEFAULT false;
