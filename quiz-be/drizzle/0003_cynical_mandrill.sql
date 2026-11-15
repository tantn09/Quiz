ALTER TABLE "users" ADD COLUMN "email" varchar(254);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subject" varchar(120);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "workplace" varchar(200);--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");