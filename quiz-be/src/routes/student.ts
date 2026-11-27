import { identityKey } from "./roster.js";
import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { answers, attemptDepartures, questions, quizzes, quizVariants, students, submissions, type QuestionSnapshot } from "../db/schema.js";

const identityBody = z.object({ name: z.string().trim().min(1).max(160), className: z.string().trim().max(80).optional() });
const answersBody = z.object({
  answers: z.record(z.string().uuid(), z.union([z.string().max(10000), z.number().int().min(0), z.null()])),
  trigger: z.literal("departure_limit").optional(),
  departures: z.array(z.object({ id: z.string().uuid(), occurredAt: z.string().datetime() })).optional(),
});
const digest = (token: string) => createHash("sha256").update(token).digest("hex");

async function saveDepartures(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  attempt: { id: string; startedAt: Date; dueAt: Date },
  departures: z.infer<typeof answersBody>["departures"],
) {
  const now = new Date();
  const events = (departures ?? []).map(({ id, occurredAt }) => ({
    submissionId: attempt.id, eventId: id, occurredAt: new Date(occurredAt),
  })).filter((event) => event.occurredAt >= attempt.startedAt && event.occurredAt < attempt.dueAt && event.occurredAt <= now);
  if (events.length) await tx.insert(attemptDepartures).values(events).onConflictDoNothing();
}

async function readDepartureIds(tx: Pick<typeof db, "select">, id: string) {
  const rows = await tx.select({ id: attemptDepartures.eventId }).from(attemptDepartures).where(eq(attemptDepartures.submissionId, id));
  return rows.map((row) => row.id);
}

async function finalizeAttempt(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  attempt: { id: string; questionSnapshot: QuestionSnapshot[] },
  latest: z.infer<typeof answersBody>["answers"],
  departureLimitSubmitted: boolean,
) {
  const byId = new Map(attempt.questionSnapshot.map((question) => [question.id, question]));
  const saved = departureLimitSubmitted
    ? await tx.select({ id: answers.questionId, value: answers.answer }).from(answers).where(eq(answers.submissionId, attempt.id))
    : [];
  const entries = Object.entries({ ...Object.fromEntries(saved.map(({ id, value }) => [id, value])), ...latest }).filter(([id]) => byId.has(id));
  let autoScore = 0;
  const hasEssay = attempt.questionSnapshot.some((question) => question.type === "essay");
  if (entries.length) {
    const updatedAt = new Date();
    const rows = entries.map(([questionId, value]) => {
      const question = byId.get(questionId)!;
      const isCorrect = question.type === "essay" ? null : value !== null && value !== "" && Number(value) === question.correctOption;
      const awardedPoints = isCorrect === null ? null : isCorrect ? question.points : 0;
      autoScore += awardedPoints ?? 0;
      return { submissionId: attempt.id, questionId, answer: String(value ?? ""), awardedPoints, isCorrect, updatedAt };
    });
    await tx.insert(answers).values(rows).onConflictDoUpdate({
      target: [answers.submissionId, answers.questionId],
      set: {
        answer: sql`excluded.answer`, updatedAt,
        awardedPoints: sql`case when excluded.is_correct is null then ${answers.awardedPoints} else excluded.awarded_points end`,
        isCorrect: sql`case when excluded.is_correct is null then ${answers.isCorrect} else excluded.is_correct end`,
      },
    });
  }
  await tx.update(submissions).set({ submittedAt: new Date(), score: autoScore, departureLimitSubmitted, gradingStatus: hasEssay ? "needs_review" : "graded" }).where(and(eq(submissions.id, attempt.id), isNull(submissions.submittedAt)));
}

function publicQuestions(items: QuestionSnapshot[]) {
  return items.map(({ id, position, type, prompt, options, points }) => ({ id, position, type, prompt, options, points }));
}

async function readAttempt(request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  const token = request.headers["x-resume-token"];
  if (!params.success || typeof token !== "string" || token.length < 32 || token.length > 100) {
    await reply.code(401).send({ error: "invalid_attempt" });
    return null;
  }
  const [attempt] = await db.select().from(submissions).where(and(eq(submissions.id, params.data.id), eq(submissions.resumeTokenHash, digest(token)))).limit(1);
  if (!attempt) await reply.code(401).send({ error: "invalid_attempt" });
  return attempt ?? null;
}

export async function studentRoutes(app: FastifyInstance): Promise<void> {
  app.get("/public/quizzes/:token", async (request, reply) => {
    const params = z.object({ token: z.string().min(20).max(80) }).safeParse(request.params);
    if (!params.success) return reply.code(404).send({ error: "not_found" });
    const query = z.object({ view: z.enum(["entry", "title"]).optional() }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_request" });
    const { view } = query.data;
    const fields = { title: quizzes.title, status: quizzes.status, linkExpiresAt: quizzes.linkExpiresAt };
    const [quiz] = await db.select(view === "title" ? fields : {
      ...fields, description: quizzes.description, subject: quizzes.subject, gradeLevel: quizzes.gradeLevel,
      assignedClass: quizzes.assignedClass, ...(view === "entry" ? {} : { promptDocument: quizzes.promptDocument }),
    }).from(quizzes).where(eq(quizzes.linkToken, params.data.token)).limit(1);
    if (!quiz || quiz.status !== "active" || (quiz.linkExpiresAt && quiz.linkExpiresAt <= new Date())) return reply.code(410).send({ error: "link_expired" });
    const { status, linkExpiresAt, ...entry } = quiz;
    return view === "title" ? { quiz: entry } : { quiz: entry, questions: [] };
  });

  app.post("/public/quizzes/:token/start", async (request, reply) => {
    const params = z.object({ token: z.string().min(20).max(80) }).safeParse(request.params);
    const body = identityBody.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    const resumeToken = randomBytes(32).toString("base64url");
    const result = await db.transaction(async (tx) => {
      const [quiz] = await tx.select().from(quizzes).where(eq(quizzes.linkToken, params.data.token)).for("update").limit(1);
      if (!quiz || quiz.status !== "active" || (quiz.linkExpiresAt && quiz.linkExpiresAt <= new Date())) return { kind: "expired" as const };
      const studentClass = quiz.assignedClass ?? body.data.className;
      if (!studentClass) return { kind: "invalid" as const };
      const nameKey = identityKey(body.data.name);
      const classKey = identityKey(studentClass);
      const [member] = quiz.assignedClass ? await tx.select({ id: students.id, name: students.name, nameKey: students.nameKey })
        .from(students).where(and(eq(students.teacherId, quiz.teacherId), eq(students.classKey, classKey), eq(students.deleted, false)))
        .orderBy(sql`(${students.nameKey} = ${nameKey}) desc`).limit(1) : [];
      if (member && member.nameKey !== nameKey) return { kind: "not_listed" as const };
      const student = member;
      const [existing] = await tx.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.quizId, quiz.id), or(student ? eq(submissions.studentId, student.id) : undefined, and(eq(submissions.studentNameKey, nameKey), eq(submissions.studentClassKey, classKey))))).limit(1);
      if (existing) return { kind: "duplicate" as const };
      const [variant] = await tx.select().from(quizVariants).where(and(eq(quizVariants.quizId, quiz.id), eq(quizVariants.active, true), eq(quizVariants.deleted, false))).orderBy(quizVariants.assignedCount, quizVariants.code).limit(1);
      if (!variant) return { kind: "invalid" as const };
      const items = await tx.select().from(questions).where(eq(questions.variantId, variant.id)).orderBy(questions.position);
      const snapshot: QuestionSnapshot[] = items.map((question) => ({
        id: question.id,
        position: question.position,
        type: question.type as QuestionSnapshot["type"],
        prompt: question.prompt,
        options: question.options,
        correctOption: question.correctOption,
        points: question.points,
      }));
      const startedAt = new Date();
      const dueAt = new Date(startedAt.getTime() + quiz.durationMinutes * 60_000);
      const [attempt] = await tx.insert(submissions).values({ quizId: quiz.id, variantId: variant.id, studentId: student?.id, studentName: student?.name ?? body.data.name, studentClass, studentNameKey: nameKey, studentClassKey: classKey, resumeTokenHash: digest(resumeToken), startedAt, dueAt, departureLimitEnabled: true, questionSnapshot: snapshot, promptSnapshot: quiz.promptDocument }).returning();
      await tx.update(quizVariants).set({ assignedCount: sql`${quizVariants.assignedCount} + 1` }).where(eq(quizVariants.id, variant.id));
      return { kind: "created" as const, quiz, attempt, snapshot, code: variant.code };
    });
    if (result.kind === "expired") return reply.code(410).send({ error: "link_expired" });
    if (result.kind === "invalid") return reply.code(400).send({ error: "class_required" });
    if (result.kind === "not_listed") return reply.code(403).send({ error: "student_not_listed" });
    if (result.kind === "duplicate") return reply.code(409).send({ error: "attempt_exists" });
    return reply.code(201).send({ serverNow: new Date().toISOString(), attempt: { id: result.attempt.id, startedAt: result.attempt.startedAt, dueAt: result.attempt.dueAt, departureLimitEnabled: true, departureIds: [], variantCode: result.code }, resumeToken, quiz: { title: result.quiz.title, prompt: result.attempt.promptSnapshot }, questions: publicQuestions(result.snapshot) });
  });

  app.get("/public/attempts/:id", async (request, reply) => {
    const attempt = await readAttempt(request, reply);
    if (!attempt) return;
    const [quiz] = await db.select({ title: quizzes.title, description: quizzes.description }).from(quizzes).where(eq(quizzes.id, attempt.quizId)).limit(1);
    const saved = await db.select({ questionId: answers.questionId, answer: answers.answer }).from(answers).where(eq(answers.submissionId, attempt.id));
    const [variant] = await db.select({ code: quizVariants.code }).from(quizVariants).where(eq(quizVariants.id, attempt.variantId!)).limit(1);
    const departureIds = await readDepartureIds(db, attempt.id);
    return { serverNow: new Date().toISOString(), attempt: { id: attempt.id, dueAt: attempt.dueAt, submitted: Boolean(attempt.submittedAt), departureLimitEnabled: attempt.departureLimitEnabled, departureLimitSubmitted: attempt.departureLimitSubmitted, departureIds, variantCode: variant?.code }, quiz, prompt: attempt.promptSnapshot, questions: publicQuestions(attempt.questionSnapshot), answers: Object.fromEntries(saved.map((entry) => [entry.questionId, entry.answer])) };
  });

  app.put("/public/attempts/:id/answers", async (request, reply) => {
    const attempt = await readAttempt(request, reply);
    if (!attempt) return;
    const body = answersBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request" });
    if (attempt.submittedAt) return reply.code(409).send({ error: "already_submitted", departureLimitSubmitted: attempt.departureLimitSubmitted });
    if (attempt.dueAt <= new Date()) return reply.code(409).send({ error: "time_expired" });
    const ids = new Set(attempt.questionSnapshot.map((question) => question.id));
    const entries = Object.entries(body.data.answers).filter(([id]) => ids.has(id));
    const saved = await db.transaction(async (tx) => {
      const [current] = await tx.select({ submittedAt: submissions.submittedAt, departureLimitSubmitted: submissions.departureLimitSubmitted, dueAt: submissions.dueAt }).from(submissions).where(eq(submissions.id, attempt.id)).for("update");
      if (!current || current.submittedAt) return { error: "already_submitted", departureLimitSubmitted: current?.departureLimitSubmitted };
      if (current.dueAt <= new Date()) return { error: "time_expired" };
      await saveDepartures(tx, { ...attempt, dueAt: current.dueAt }, body.data.departures);
      if (entries.length) {
        const updatedAt = new Date();
        await tx.insert(answers).values(entries.map(([questionId, value]) => ({
          submissionId: attempt.id, questionId, answer: String(value ?? ""), updatedAt,
        }))).onConflictDoUpdate({
          target: [answers.submissionId, answers.questionId],
          set: { answer: sql`excluded.answer`, updatedAt },
        });
      }
      const departureIds = await readDepartureIds(tx, attempt.id);
      const limited = attempt.departureLimitEnabled && departureIds.length >= 3;
      if (limited) await finalizeAttempt(tx, attempt, {}, true);
      return { departureIds, departureLimitSubmitted: limited };
    });
    if ("error" in saved) return reply.code(409).send(saved);
    return { ...saved, savedAt: new Date().toISOString() };
  });

  app.post("/public/attempts/:id/submit", async (request, reply) => {
    const attempt = await readAttempt(request, reply);
    if (!attempt) return;
    const body = answersBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request" });
    if (attempt.submittedAt) return reply.code(409).send({ error: "already_submitted", departureLimitSubmitted: attempt.departureLimitSubmitted });
    const submitted = await db.transaction(async (tx) => {
      const [current] = await tx.select({ submittedAt: submissions.submittedAt, departureLimitSubmitted: submissions.departureLimitSubmitted, dueAt: submissions.dueAt }).from(submissions).where(eq(submissions.id, attempt.id)).for("update");
      if (!current || current.submittedAt) return { error: "already_submitted", departureLimitSubmitted: current?.departureLimitSubmitted };
      await saveDepartures(tx, { ...attempt, dueAt: current.dueAt }, body.data.departures);
      const departureIds = await readDepartureIds(tx, attempt.id);
      const limited = attempt.departureLimitEnabled && departureIds.length >= 3;
      if (body.data.trigger && !limited) return { departureIds };
      await finalizeAttempt(tx, attempt, body.data.answers, limited);
      return { submitted: true, departureLimitSubmitted: limited };
    });
    if ("error" in submitted) return reply.code(409).send(submitted);
    if ("departureIds" in submitted) return reply.code(409).send({ error: "departure_limit_not_reached", departureIds: submitted.departureIds });
    return reply.code(201).send(submitted);
  });
}
