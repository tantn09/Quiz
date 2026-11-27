CREATE TABLE "attempt_departures" (
  "submission_id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  CONSTRAINT "attempt_departures_submission_id_submissions_id_fk"
    FOREIGN KEY ("submission_id") REFERENCES "submissions" ("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_departures_submission_event" ON "attempt_departures" ("submission_id", "event_id");
