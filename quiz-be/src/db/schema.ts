import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "teacher"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 80 }).notNull().unique(),
  displayName: varchar("display_name", { length: 160 }).notNull(),
  email: varchar("email", { length: 254 }),
  subject: varchar("subject", { length: 120 }),
  workplace: varchar("workplace", { length: 200 }),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("teacher"),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  language: varchar("language", { length: 8 }).notNull().default("vi"),
  theme: varchar("theme", { length: 8 }).notNull().default("light"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subjects = pgTable("subjects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  nameKey: varchar("name_key", { length: 120 }).notNull().unique(),
});

export const gradeLevels = pgTable("grade_levels", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  nameKey: varchar("name_key", { length: 120 }).notNull().unique(),
});

export const quizzes = pgTable("quizzes", {
  id: uuid("id").defaultRandom().primaryKey(),
  teacherId: uuid("teacher_id").notNull().references(() => users.id),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull().default(""),
  promptDocument: jsonb("prompt_document").$type<PromptDocument>().notNull().default({ type: "doc", content: [] }),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  durationMinutes: integer("duration_minutes").notNull(),
  subject: varchar("subject", { length: 120 }),
  gradeLevel: varchar("grade_level", { length: 120 }),
  assignedClass: varchar("assigned_class", { length: 80 }),
  linkExpiresAt: timestamp("link_expires_at", { withTimezone: true }),
  linkToken: varchar("link_token", { length: 64 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").references(() => quizVariants.id),
  position: integer("position").notNull(),
  type: varchar("type", { length: 16 }).notNull(),
  prompt: text("prompt").notNull(),
  options: jsonb("options").$type<string[]>().notNull().default([]),
  correctOption: integer("correct_option"),
  points: integer("points").notNull().default(1),
});

export const quizVariants = pgTable("quiz_variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  code: integer("code").notNull(),
  active: boolean("active").notNull().default(true),
  deleted: boolean("deleted").notNull().default(false),
  assignedCount: integer("assigned_count").notNull().default(0),
}, (table) => [uniqueIndex("quiz_variant_code").on(table.quizId, table.code)]);

export const submissions = pgTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id").notNull().references(() => quizzes.id),
  variantId: uuid("variant_id").references(() => quizVariants.id),
  studentName: varchar("student_name", { length: 160 }).notNull(),
  studentClass: varchar("student_class", { length: 80 }).notNull(),
  studentNameKey: varchar("student_name_key", { length: 160 }).notNull(),
  studentClassKey: varchar("student_class_key", { length: 80 }).notNull(),
  resumeTokenHash: varchar("resume_token_hash", { length: 64 }).notNull().unique(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  score: integer("score"),
  gradingStatus: varchar("grading_status", { length: 16 }).notNull().default("pending"),
  questionSnapshot: jsonb("question_snapshot").$type<QuestionSnapshot[]>().notNull(),
  promptSnapshot: jsonb("prompt_snapshot").$type<PromptDocument>(),
}, (table) => [uniqueIndex("submission_quiz_student_identity").on(table.quizId, table.studentNameKey, table.studentClassKey)]);

export type PromptImage = { id: string; alt: string };
export type PromptDocument = { type: "doc"; content: unknown[] };

export const quizAssets = pgTable("quiz_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  mimeType: varchar("mime_type", { length: 20 }).notNull(),
  size: integer("size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  draftReservedUntil: timestamp("draft_reserved_until", { withTimezone: true }),
});

export type QuestionSnapshot = {
  id: string;
  position: number;
  type: "choice" | "essay";
  prompt: string;
  options: string[];
  correctOption: number | null;
  points: number;
};

export const answers = pgTable("answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionId: uuid("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull(),
  answer: text("answer"),
  awardedPoints: integer("awarded_points"),
  isCorrect: boolean("is_correct"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("answer_submission_question").on(table.submissionId, table.questionId)]);
