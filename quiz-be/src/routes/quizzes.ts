import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { requireTeacherAccess } from "../auth.js";
import { db } from "../db/index.js";
import { promptDocumentSchema, promptImageIds } from "../prompt-document.js";
import { questions, quizzes, submissions, quizAssets, subjects, gradeLevels } from "../db/schema.js";

const questionInput = z.object({
  type: z.enum(["choice", "essay"]),
  prompt: z.string().trim().min(1).max(5000),
  options: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
  correctOption: z.number().int().min(0).nullable().default(null),
  points: z.number().int().min(0).max(1000).default(1),
}).superRefine((question, context) => {
  if (question.type === "choice" && (question.options.length < 2 || question.correctOption === null || question.correctOption >= question.options.length)) {
    context.addIssue({ code: "custom", message: "Câu trắc nghiệm cần ít nhất hai lựa chọn và đáp án đúng hợp lệ." });
  }
  if (question.type === "essay" && (question.options.length > 0 || question.correctOption !== null)) {
    context.addIssue({ code: "custom", message: "Câu tự luận không có lựa chọn hoặc đáp án đúng." });
  }
});

export const quizInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).default(""),
  promptDocument: promptDocumentSchema,
  durationMinutes: z.number().int().min(1).max(1440),
  linkExpiresAt: z.string().datetime().nullable().default(null),
  subjectId: z.string().uuid().nullable().default(null),
  gradeLevelId: z.string().uuid().nullable().default(null),
  subject: z.string().trim().max(120).optional(),
  gradeLevel: z.string().trim().max(120).optional(),
  assignedClass: z.string().trim().max(80).nullable().default(null),
  questions: z.array(questionInput).min(1).max(200),
});

async function resolveLabels(data: z.infer<typeof quizInput>, existing?: typeof quizzes.$inferSelect) {
  const [subject] = data.subjectId ? await db.select({ name: subjects.name }).from(subjects).where(eq(subjects.id, data.subjectId)).limit(1) : [];
  const [grade] = data.gradeLevelId ? await db.select({ name: gradeLevels.name }).from(gradeLevels).where(eq(gradeLevels.id, data.gradeLevelId)).limit(1) : [];
  const subjectName = subject?.name ?? (!data.subjectId && existing?.subject === data.subject ? existing?.subject : null);
  const gradeName = grade?.name ?? (!data.gradeLevelId && existing?.gradeLevel === data.gradeLevel ? existing?.gradeLevel : null);
  return subjectName && gradeName ? { subject: subjectName, gradeLevel: gradeName } : null;
}

async function hasAssets(document: z.infer<typeof promptDocumentSchema>): Promise<boolean> {
  const ids = [...new Set(promptImageIds(document))];
  if (!ids.length) return true;
  const rows = await db.select({ id: quizAssets.id }).from(quizAssets).where(inArray(quizAssets.id, ids));
  return rows.length === ids.length;
}

export async function quizRoutes(app: FastifyInstance): Promise<void> {
  app.get("/teacher/quizzes", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const parsed = z.object({ search: z.string().trim().max(100).optional(), status: z.enum(["active", "inactive"]).optional() }).safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const filters = [ne(quizzes.status, "deleted")];
    if (request.authUser!.role !== "admin") filters.push(eq(quizzes.teacherId, request.authUser!.id));
    if (parsed.data.status) filters.push(eq(quizzes.status, parsed.data.status));
    if (parsed.data.search) filters.push(or(ilike(quizzes.title, `%${parsed.data.search}%`), ilike(quizzes.description, `%${parsed.data.search}%`))!);
    const rows = await db.select().from(quizzes).where(filters.length ? and(...filters) : undefined).orderBy(desc(quizzes.createdAt));
    return { quizzes: rows };
  });

  app.post("/teacher/quizzes", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const parsed = quizInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    const labels = await resolveLabels(parsed.data);
    if (!labels) return reply.code(400).send({ error: "invalid_catalog_selection" });
    if (!(await hasAssets(parsed.data.promptDocument))) return reply.code(400).send({ error: "invalid_assets" });
    const linkToken = randomBytes(24).toString("base64url");
    const [created] = await db.transaction(async (tx) => {
      const [quiz] = await tx.insert(quizzes).values({
        teacherId: request.authUser!.id,
        title: parsed.data.title,
        description: parsed.data.description,
        promptDocument: parsed.data.promptDocument,
        durationMinutes: parsed.data.durationMinutes,
        assignedClass: parsed.data.assignedClass,
        ...labels,
        linkExpiresAt: parsed.data.linkExpiresAt ? new Date(parsed.data.linkExpiresAt) : null,
        linkToken,
      }).returning();
      await tx.insert(questions).values(parsed.data.questions.map((question, position) => ({ ...question, quizId: quiz.id, position })));
      return [quiz];
    });
    return reply.code(201).send({ quiz: created, link: `/q/${linkToken}` });
  });

  app.get("/teacher/quizzes/:id", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    const [quiz] = await db.select().from(quizzes).where(and(eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted"), request.authUser!.role === "admin" ? undefined : eq(quizzes.teacherId, request.authUser!.id))).limit(1);
    if (!quiz) return reply.code(404).send({ error: "not_found" });
    const items = await db.select().from(questions).where(eq(questions.quizId, quiz.id)).orderBy(questions.position);
    return { quiz, questions: items };
  });

  app.put("/teacher/quizzes/:id", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const parsed = quizInput.safeParse(request.body);
    if (!params.success || !parsed.success) return reply.code(400).send({ error: "invalid_request", details: parsed.success ? undefined : parsed.error.flatten() });
    if (!(await hasAssets(parsed.data.promptDocument))) return reply.code(400).send({ error: "invalid_assets" });
    const filters = [eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted")];
    if (request.authUser!.role !== "admin") filters.push(eq(quizzes.teacherId, request.authUser!.id));
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(quizzes).where(and(...filters)).for("update").limit(1);
      if (!existing) return null;
      const labels = await resolveLabels(parsed.data, existing);
      if (!labels) return null;
      const [quiz] = await tx.update(quizzes).set({ title: parsed.data.title, description: parsed.data.description, promptDocument: parsed.data.promptDocument, durationMinutes: parsed.data.durationMinutes, assignedClass: existing.assignedClass, linkExpiresAt: parsed.data.linkExpiresAt ? new Date(parsed.data.linkExpiresAt) : null, ...labels, updatedAt: new Date() }).where(and(...filters)).returning();
      if (!quiz) return null;
      await tx.delete(questions).where(eq(questions.quizId, quiz.id));
      await tx.insert(questions).values(parsed.data.questions.map((question, position) => ({ ...question, quizId: quiz.id, position })));
      return quiz;
    });
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return { quiz: updated };
  });

  app.post("/teacher/quizzes/:id/clone", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ assignedClass: z.string().trim().min(1).max(80) }).safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    const cloned = await db.transaction(async (tx) => {
      const [source] = await tx.select().from(quizzes).where(and(eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted"), request.authUser!.role === "admin" ? undefined : eq(quizzes.teacherId, request.authUser!.id))).limit(1);
      if (!source) return null;
      const sourceQuestions = await tx.select().from(questions).where(eq(questions.quizId, source.id)).orderBy(questions.position);
      const [quiz] = await tx.insert(quizzes).values({ teacherId: source.teacherId, title: source.title, description: source.description, promptDocument: source.promptDocument, status: "inactive", durationMinutes: source.durationMinutes, subject: source.subject, gradeLevel: source.gradeLevel, assignedClass: body.data.assignedClass, linkExpiresAt: source.linkExpiresAt && source.linkExpiresAt > new Date() ? source.linkExpiresAt : null, linkToken: randomBytes(24).toString("base64url") }).returning();
      if (sourceQuestions.length) await tx.insert(questions).values(sourceQuestions.map(({ position, type, prompt, options, correctOption, points }) => ({ quizId: quiz.id, position, type, prompt, options, correctOption, points })));
      return quiz;
    });
    if (!cloned) return reply.code(404).send({ error: "not_found" });
    return reply.code(201).send({ quiz: cloned, link: `/q/${cloned.linkToken}` });
  });

  app.post("/teacher/quizzes/:id/stop", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    const filters = [eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted")];
    if (request.authUser!.role !== "admin") filters.push(eq(quizzes.teacherId, request.authUser!.id));
    const [updated] = await db.update(quizzes).set({ status: "inactive", updatedAt: new Date() }).where(and(...filters)).returning({ id: quizzes.id });
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return reply.code(204).send();
  });

  app.post("/teacher/quizzes/:id/extend-link", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ linkExpiresAt: z.string().datetime() }).safeParse(request.body);
    if (!params.success || !body.success || new Date(body.data.linkExpiresAt) <= new Date()) return reply.code(400).send({ error: "invalid_request" });
    const filters = [eq(quizzes.id, params.data.id), eq(quizzes.status, "active")];
    if (request.authUser!.role !== "admin") filters.push(eq(quizzes.teacherId, request.authUser!.id));
    const [updated] = await db.update(quizzes).set({ linkExpiresAt: new Date(body.data.linkExpiresAt), updatedAt: new Date() }).where(and(...filters)).returning({ id: quizzes.id, linkExpiresAt: quizzes.linkExpiresAt });
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return { quiz: updated };
  });

  app.post("/teacher/quizzes/:id/reopen", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ linkExpiresAt: z.string().datetime().optional() }).safeParse(request.body);
    if (!params.success || !body.success || (body.data.linkExpiresAt && new Date(body.data.linkExpiresAt) <= new Date())) return reply.code(400).send({ error: "invalid_request" });
    const filters = [eq(quizzes.id, params.data.id), eq(quizzes.status, "inactive")];
    if (request.authUser!.role !== "admin") filters.push(eq(quizzes.teacherId, request.authUser!.id));
    const [existing] = await db.select().from(quizzes).where(and(...filters)).limit(1);
    if (!existing || (!body.data.linkExpiresAt && existing.linkExpiresAt && existing.linkExpiresAt <= new Date())) return reply.code(400).send({ error: "invalid_request" });
    const [updated] = await db.update(quizzes).set({ status: "active", ...(body.data.linkExpiresAt ? { linkExpiresAt: new Date(body.data.linkExpiresAt) } : {}), updatedAt: new Date() }).where(and(...filters)).returning({ id: quizzes.id, status: quizzes.status, linkExpiresAt: quizzes.linkExpiresAt });
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return { quiz: updated };
  });

  app.delete("/teacher/quizzes/:id", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    const filters = [eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted")];
    if (request.authUser!.role !== "admin") filters.push(eq(quizzes.teacherId, request.authUser!.id));
    const [deleted] = await db.update(quizzes).set({ status: "deleted", updatedAt: new Date() }).where(and(...filters)).returning({ id: quizzes.id });
    if (!deleted) return reply.code(404).send({ error: "not_found" });
    return reply.code(204).send();
  });

  app.post("/teacher/quizzes/:id/extend-attempts", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ additionalMinutes: z.number().int().min(1).max(1440) }).safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    const owner = await db.select({ id: quizzes.id }).from(quizzes).where(and(eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted"), request.authUser!.role === "admin" ? undefined : eq(quizzes.teacherId, request.authUser!.id))).limit(1);
    if (!owner.length) return reply.code(404).send({ error: "not_found" });
    await db.update(submissions).set({ dueAt: sql`${submissions.dueAt} + (${body.data.additionalMinutes} * interval '1 minute')` }).where(and(eq(submissions.quizId, params.data.id), isNull(submissions.submittedAt)));
    return { updated: true };
  });
}
