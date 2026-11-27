ALTER TABLE "submissions" ADD COLUMN "departure_limit_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "departure_limit_submitted" boolean DEFAULT false NOT NULL;
