ALTER TABLE "quizzes" ADD COLUMN "prompt_document" jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb;--> statement-breakpoint
UPDATE "quizzes" SET "prompt_document" = jsonb_build_object('type','doc','content', CASE WHEN "prompt_text" = '' THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',"prompt_text")))) END);--> statement-breakpoint
UPDATE "submissions" SET "prompt_snapshot" = jsonb_build_object('type','doc','content', CASE WHEN COALESCE("prompt_snapshot"->>'text','') = '' THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',"prompt_snapshot"->>'text')))) END) WHERE "prompt_snapshot" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" DROP COLUMN "prompt_text";--> statement-breakpoint
ALTER TABLE "quizzes" DROP COLUMN "prompt_images";
