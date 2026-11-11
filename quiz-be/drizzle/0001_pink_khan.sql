ALTER TABLE "submissions" ADD COLUMN "student_name_key" varchar(160) NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "student_class_key" varchar(80) NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "resume_token_hash" varchar(64) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "answer_submission_question" ON "answers" USING btree ("submission_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_quiz_student_identity" ON "submissions" USING btree ("quiz_id","student_name_key","student_class_key");--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_resume_token_hash_unique" UNIQUE("resume_token_hash");