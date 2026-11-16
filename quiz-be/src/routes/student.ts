import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { answers, questions, quizzes, submissions, type QuestionSnapshot } from "../db/schema.js";

const identityBody = z.object({ name: z.string().trim().min(1).max(160), className: z.string().trim().min(1).max(80) });
const answersBody = z.object({ answers: z.record(z.string().uuid(), z.union([z.string().max(10000), z.number().int().min(0), z.null()])) });
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const identityKey = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");

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
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.linkToken, params.data.token)).limit(1);
    if (!quiz || quiz.status !== "active" || (!quiz.classConfigs.length && quiz.linkExpiresAt && quiz.linkExpiresAt <= new Date())) return reply.code(410).send({ error: "link_expired" });
    const items = await db.select().from(questions).where(eq(questions.quizId, quiz.id)).orderBy(questions.position);
    return { quiz: { title: quiz.title, description: quiz.description, promptText: quiz.promptText, promptImages: quiz.promptImages, subject: quiz.subject, classConfigs: quiz.classConfigs }, questions: items.map(({ id, position, type, prompt, options, points }) => ({ id, position, type, prompt, options, points })) };
  });

  app.post("/public/quizzes/:token/start", async (request, reply) => {
    const params = z.object({ token: z.string().min(20).max(80) }).safeParse(request.params);
    const body = identityBody.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    const resumeToken = randomBytes(32).toString("base64url");
    const result = await db.transaction(async (tx) => {
      const [quiz] = await tx.select().from(quizzes).where(eq(quizzes.linkToken, params.data.token)).for("update").limit(1);
      if (!quiz || quiz.status !== "active" || (!quiz.classConfigs.length && quiz.linkExpiresAt && quiz.linkExpiresAt <= new Date())) return { kind: "expired" as const };
      if (quiz.classConfigs.length) {
        const selected = quiz.classConfigs.find((item) => identityKey(item.name) === identityKey(body.data.className));
        if (!selected) return { kind: "invalid_class" as const };
        if (new Date(selected.expiresAt) <= new Date()) return { kind: "expired" as const };
      }
      const nameKey = identityKey(body.data.name);
      const classKey = identityKey(body.data.className);
      const [existing] = await tx.select().from(submissions).where(and(eq(submissions.quizId, quiz.id), eq(submissions.studentNameKey, nameKey), eq(submissions.studentClassKey, classKey))).limit(1);
      if (existing) return { kind: "duplicate" as const };
      const items = await tx.select().from(questions).where(eq(questions.quizId, quiz.id)).orderBy(questions.position);
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
      const [attempt] = await tx.insert(submissions).values({ quizId: quiz.id, studentName: body.data.name, studentClass: body.data.className, studentNameKey: nameKey, studentClassKey: classKey, resumeTokenHash: digest(resumeToken), startedAt, dueAt, questionSnapshot: snapshot, promptSnapshot: { text: quiz.promptText, images: quiz.promptImages } }).returning();
      return { kind: "created" as const, quiz, attempt, snapshot };
    });
    if (result.kind === "expired") return reply.code(410).send({ error: "link_expired" });
    if (result.kind === "invalid_class") return reply.code(400).send({ error: "invalid_class" });
    if (result.kind === "duplicate") return reply.code(409).send({ error: "attempt_exists" });
    return reply.code(201).send({ attempt: { id: result.attempt.id, startedAt: result.attempt.startedAt, dueAt: result.attempt.dueAt }, resumeToken, quiz: { title: result.quiz.title, prompt: result.attempt.promptSnapshot }, questions: publicQuestions(result.snapshot) });
  });

  app.get("/public/attempts/:id", async (request, reply) => {
    const attempt = await readAttempt(request, reply);
    if (!attempt) return;
    const [quiz] = await db.select({ title: quizzes.title, description: quizzes.description }).from(quizzes).where(eq(quizzes.id, attempt.quizId)).limit(1);
    const saved = await db.select({ questionId: answers.questionId, answer: answers.answer }).from(answers).where(eq(answers.submissionId, attempt.id));
    return { attempt: { id: attempt.id, dueAt: attempt.dueAt, submitted: Boolean(attempt.submittedAt) }, quiz, prompt: attempt.promptSnapshot, questions: publicQuestions(attempt.questionSnapshot), answers: Object.fromEntries(saved.map((entry) => [entry.questionId, entry.answer])) };
  });

  app.put("/public/attempts/:id/answers", async (request, reply) => {
    const attempt = await readAttempt(request, reply);
    if (!attempt) return;
    const body = answersBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request" });
    if (attempt.submittedAt) return reply.code(409).send({ error: "already_submitted" });
    if (attempt.dueAt <= new Date()) return reply.code(409).send({ error: "time_expired" });
    const ids = new Set(attempt.questionSnapshot.map((question) => question.id));
    const entries = Object.entries(body.data.answers).filter(([id]) => ids.has(id));
    await db.transaction(async (tx) => {
      for (const [questionId, value] of entries) {
        await tx.insert(answers).values({ submissionId: attempt.id, questionId, answer: String(value ?? ""), updatedAt: new Date() })
          .onConflictDoUpdate({ target: [answers.submissionId, answers.questionId], set: { answer: String(value ?? ""), updatedAt: new Date() } });
      }
    });
    return { savedAt: new Date().toISOString() };
  });

  app.post("/public/attempts/:id/submit", async (request, reply) => {
    const attempt = await readAttempt(request, reply);
    if (!attempt) return;
    const body = answersBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request" });
    if (attempt.submittedAt) return reply.code(409).send({ error: "already_submitted" });
    const byId = new Map(attempt.questionSnapshot.map((question) => [question.id, question]));
    const entries = Object.entries(body.data.answers).filter(([id]) => byId.has(id));
    let autoScore = 0;
    let hasEssay = attempt.questionSnapshot.some((question) => question.type === "essay");
    await db.transaction(async (tx) => {
      for (const [questionId, value] of entries) {
        const question = byId.get(questionId)!;
        if (question.type === "essay") {
          await tx.insert(answers).values({ submissionId: attempt.id, questionId, answer: String(value ?? ""), awardedPoints: null, isCorrect: null, updatedAt: new Date() })
            .onConflictDoUpdate({ target: [answers.submissionId, answers.questionId], set: { answer: String(value ?? ""), updatedAt: new Date() } });
        } else {
          const isCorrect = Number(value) === question.correctOption;
          const score = isCorrect ? question.points : 0;
          autoScore += score;
          await tx.insert(answers).values({ submissionId: attempt.id, questionId, answer: String(value ?? ""), awardedPoints: score, isCorrect, updatedAt: new Date() })
            .onConflictDoUpdate({ target: [answers.submissionId, answers.questionId], set: { answer: String(value ?? ""), awardedPoints: score, isCorrect, updatedAt: new Date() } });
        }
      }
      await tx.update(submissions).set({ submittedAt: new Date(), score: autoScore, gradingStatus: hasEssay ? "needs_review" : "graded" }).where(and(eq(submissions.id, attempt.id), isNull(submissions.submittedAt)));
    });
    return reply.code(201).send({ submitted: true });
  });
}
