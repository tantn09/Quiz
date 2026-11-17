CREATE TABLE "quiz_variants" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "quiz_id" uuid NOT NULL REFERENCES "quizzes"("id") ON DELETE CASCADE, "code" integer NOT NULL, "active" boolean NOT NULL DEFAULT true, "assigned_count" integer NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX "quiz_variant_code" ON "quiz_variants"("quiz_id", "code");
INSERT INTO "quiz_variants"("quiz_id", "code", "assigned_count") SELECT q."id", 101, (SELECT count(*) FROM "submissions" s WHERE s."quiz_id" = q."id") FROM "quizzes" q;
ALTER TABLE "questions" ADD COLUMN "variant_id" uuid REFERENCES "quiz_variants"("id");
ALTER TABLE "submissions" ADD COLUMN "variant_id" uuid REFERENCES "quiz_variants"("id");
UPDATE "questions" q SET "variant_id" = v."id" FROM "quiz_variants" v WHERE q."quiz_id" = v."quiz_id";
UPDATE "submissions" s SET "variant_id" = v."id" FROM "quiz_variants" v WHERE s."quiz_id" = v."quiz_id";
ALTER TABLE "questions" ALTER COLUMN "variant_id" SET NOT NULL;
ALTER TABLE "submissions" ALTER COLUMN "variant_id" SET NOT NULL;
