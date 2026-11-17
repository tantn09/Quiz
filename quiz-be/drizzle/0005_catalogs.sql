CREATE TABLE "subjects" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "name" varchar(120) NOT NULL, "name_key" varchar(120) NOT NULL UNIQUE);--> statement-breakpoint
CREATE TABLE "grade_levels" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "name" varchar(120) NOT NULL, "name_key" varchar(120) NOT NULL UNIQUE);--> statement-breakpoint
INSERT INTO "subjects" ("name", "name_key") VALUES ('Toán', 'toán'), ('Văn', 'văn'), ('Anh', 'anh'), ('Vật Lý', 'vật lý'), ('Hóa', 'hóa');--> statement-breakpoint
INSERT INTO "grade_levels" ("name", "name_key") VALUES ('Lớp 6', 'lớp 6'), ('Lớp 7', 'lớp 7'), ('Lớp 8', 'lớp 8'), ('Lớp 9', 'lớp 9');--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "grade_level" varchar(120);--> statement-breakpoint
UPDATE "quizzes" SET "link_expires_at" = (SELECT MAX((item->>'expiresAt')::timestamptz) FROM jsonb_array_elements("class_configs") AS item) WHERE jsonb_array_length("class_configs") > 0;--> statement-breakpoint
ALTER TABLE "quizzes" DROP COLUMN "class_configs";
