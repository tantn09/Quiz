ALTER TABLE questions ALTER COLUMN points TYPE numeric(8,2);
--> statement-breakpoint
ALTER TABLE submissions ALTER COLUMN score TYPE numeric(8,2);
--> statement-breakpoint
ALTER TABLE answers ALTER COLUMN awarded_points TYPE numeric(8,2);
--> statement-breakpoint
CREATE TABLE students (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 teacher_id uuid NOT NULL REFERENCES users(id),
 name varchar(160) NOT NULL,
 class_name varchar(80) NOT NULL,
 name_key varchar(160) NOT NULL,
 class_key varchar(80) NOT NULL,
 deleted boolean NOT NULL DEFAULT false
);
--> statement-breakpoint
CREATE UNIQUE INDEX student_identity ON students(teacher_id, class_key, name_key);
--> statement-breakpoint
CREATE TABLE access_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 quiz_id uuid NOT NULL REFERENCES quizzes(id),
 name varchar(160) NOT NULL,
 name_key varchar(160) NOT NULL,
 receipt_hash varchar(64) NOT NULL,
 status varchar(16) NOT NULL DEFAULT 'pending'
);
--> statement-breakpoint
CREATE UNIQUE INDEX access_request_identity ON access_requests(quiz_id, name_key);
--> statement-breakpoint
ALTER TABLE submissions ADD COLUMN student_id uuid REFERENCES students(id);
--> statement-breakpoint
CREATE UNIQUE INDEX submission_student ON submissions(quiz_id, student_id);
