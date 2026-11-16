ALTER TABLE "quizzes" ADD COLUMN "subject" varchar(120);--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "class_configs" jsonb DEFAULT '[]'::jsonb NOT NULL;