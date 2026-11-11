CREATE TABLE "quiz_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"mime_type" varchar(20) NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "prompt_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "prompt_images" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "prompt_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "quiz_assets" ADD CONSTRAINT "quiz_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;