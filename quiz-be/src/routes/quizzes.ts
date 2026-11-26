import { validationError } from "../api-errors.js";
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { requireTeacherAccess } from "../auth.js";
import { db } from "../db/index.js";
import { promptDocumentSchema, promptImageIds } from "../prompt-document.js";
import { questions, quizzes, submissions, quizAssets, subjects, gradeLevels, quizVariants } from "../db/schema.js";

const questionInput = z.object({
  type: z.enum(["choice", "essay"]),
  prompt: z.string().trim().min(1).max(5000),
  options: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
  correctOption: z.number().int().min(0).nullable().default(null),
  points: z.number().min(0).max(1000).multipleOf(0.25).default(1),
}).superRefine((question, context) => {
  if (question.type === "choice" && (question.options.length < 2 || question.correctOption === null || question.correctOption >= question.options.length)) {
    context.addIssue({ code: "custom", path: [question.options.length < 2 ? "options" : "correctOption"], message: "Câu trắc nghiệm cần ít nhất hai lựa chọn và đáp án đúng hợp lệ." });
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
    const parsed = z.object({ view: z.literal("list").optional(), search: z.string().trim().max(100).optional(), status: z.enum(["active", "inactive"]).optional() }).safeParse(request.query);
    if (!parsed.success) return reply.code(400).send(validationError(parsed.error, "query"));
    const filters = [ne(quizzes.status, "deleted")];
    if (request.authUser!.role !== "admin") filters.push(eq(quizzes.teacherId, request.authUser!.id));
    if (parsed.data.status) filters.push(eq(quizzes.status, parsed.data.status));
    if (parsed.data.search) filters.push(or(ilike(quizzes.title, `%${parsed.data.search}%`), ilike(quizzes.description, `%${parsed.data.search}%`))!);
    if (parsed.data.view === "list") {
      const rows = await db.select({
        id: quizzes.id, title: quizzes.title, description: quizzes.description, status: quizzes.status,
        durationMinutes: quizzes.durationMinutes, linkToken: quizzes.linkToken, linkExpiresAt: quizzes.linkExpiresAt,
        subject: quizzes.subject, gradeLevel: quizzes.gradeLevel, assignedClass: quizzes.assignedClass,
      }).from(quizzes).where(and(...filters)).orderBy(desc(quizzes.createdAt));
      return { quizzes: rows };
    }
    const rows = await db.select().from(quizzes).where(filters.length ? and(...filters) : undefined).orderBy(desc(quizzes.createdAt));
    return { quizzes: rows };
  });

  app.post("/teacher/quizzes", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const parsed = quizInput.extend({ assignedClass: z.string().trim().min(1).max(80) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(validationError(parsed.error));
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
      const [variant] = await tx.insert(quizVariants).values({ quizId: quiz.id, code: 101 }).returning();
      await tx.insert(questions).values(parsed.data.questions.map((question, position) => ({ ...question, quizId: quiz.id, variantId: variant.id, position })));
      return [quiz];
    });
    return reply.code(201).send({ quiz: created, link: `/q/${linkToken}` });
  });

  app.get("/teacher/quizzes/:id", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send(validationError(params.error, "params"));
    if ((request.query as { view?: string }).view === "title") {
      const [quiz] = await db.select({ title: quizzes.title }).from(quizzes).where(and(eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted"), request.authUser!.role === "admin" ? undefined : eq(quizzes.teacherId, request.authUser!.id))).limit(1);
      if (!quiz) return reply.code(404).send({ error: "not_found" });
      return { quiz };
    }
    const [quiz] = await db.select().from(quizzes).where(and(eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted"), request.authUser!.role === "admin" ? undefined : eq(quizzes.teacherId, request.authUser!.id))).limit(1);
    if (!quiz) return reply.code(404).send({ error: "not_found" });
    const variants = await db.select().from(quizVariants).where(and(eq(quizVariants.quizId, quiz.id), eq(quizVariants.deleted, false))).orderBy(quizVariants.code);
    const items = await db.select().from(questions).where(eq(questions.quizId, quiz.id)).orderBy(questions.position);
    return { quiz, variants: variants.map((variant) => ({ ...variant, questions: items.filter((item) => item.variantId === variant.id) })), questions: items.filter((item) => item.variantId === variants[0]?.id) };
  });

  app.put("/teacher/quizzes/:id", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const parsed = quizInput.safeParse(request.body);
    if (!params.success) return reply.code(400).send(validationError(params.error, "params"));
    if (!parsed.success) return reply.code(400).send(validationError(parsed.error));
    if (!(await hasAssets(parsed.data.promptDocument))) return reply.code(400).send({ error: "invalid_assets" });
    const filters = [eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted")];
    if (request.authUser!.role !== "admin") filters.push(eq(quizzes.teacherId, request.authUser!.id));
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(quizzes).where(and(...filters)).for("update").limit(1);
      if (!existing) return null;
      const labels = await resolveLabels(parsed.data, existing);
      if (!labels) return "invalid_catalog_selection" as const;
      const [quiz] = await tx.update(quizzes).set({ title: parsed.data.title, description: parsed.data.description, promptDocument: parsed.data.promptDocument, durationMinutes: parsed.data.durationMinutes, assignedClass: existing.assignedClass, linkExpiresAt: parsed.data.linkExpiresAt ? new Date(parsed.data.linkExpiresAt) : null, ...labels, updatedAt: new Date() }).where(and(...filters)).returning();
      if (!quiz) return null;
      const [primary] = await tx.select().from(quizVariants).where(and(eq(quizVariants.quizId, quiz.id), eq(quizVariants.deleted, false))).orderBy(quizVariants.code).limit(1);
      await tx.delete(questions).where(eq(questions.variantId, primary.id));
      await tx.insert(questions).values(parsed.data.questions.map((question, position) => ({ ...question, quizId: quiz.id, variantId: primary.id, position })));
      return quiz;
    });
    if (updated === "invalid_catalog_selection") return reply.code(400).send({ error: updated });
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return { quiz: updated };
  });

  app.post("/teacher/quizzes/:id/clone", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ assignedClass: z.string().trim().min(1).max(80) }).safeParse(request.body);
    if (!params.success) return reply.code(400).send(validationError(params.error, "params"));
    if (!body.success) return reply.code(400).send(validationError(body.error));
    const cloned = await db.transaction(async (tx) => {
      const [source] = await tx.select().from(quizzes).where(and(eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted"), request.authUser!.role === "admin" ? undefined : eq(quizzes.teacherId, request.authUser!.id))).limit(1);
      if (!source) return null;
      const sourceQuestions = await tx.select().from(questions).where(eq(questions.quizId, source.id)).orderBy(questions.position);
      const sourceVariants = await tx.select().from(quizVariants).where(and(eq(quizVariants.quizId, source.id), eq(quizVariants.deleted, false)));
      const [quiz] = await tx.insert(quizzes).values({ teacherId: source.teacherId, title: source.title, description: source.description, promptDocument: source.promptDocument, status: "inactive", durationMinutes: source.durationMinutes, subject: source.subject, gradeLevel: source.gradeLevel, assignedClass: body.data.assignedClass, linkExpiresAt: source.linkExpiresAt && source.linkExpiresAt > new Date() ? source.linkExpiresAt : null, linkToken: randomBytes(24).toString("base64url") }).returning();
      for (const sourceVariant of sourceVariants) {
        const [variant] = await tx.insert(quizVariants).values({ quizId: quiz.id, code: sourceVariant.code, active: sourceVariant.active }).returning();
        const sourceItems = sourceQuestions.filter((item) => item.variantId === sourceVariant.id);
        if (sourceItems.length) await tx.insert(questions).values(sourceItems.map(({ position, type, prompt, options, correctOption, points }) => ({ quizId: quiz.id, variantId: variant.id, position, type, prompt, options, correctOption, points })));
      }
      return quiz;
    });
    if (!cloned) return reply.code(404).send({ error: "not_found" });
    return reply.code(201).send({ quiz: cloned, link: `/q/${cloned.linkToken}` });
  });

  app.post("/teacher/quizzes/:id/variants", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = z.discriminatedUnion("mode", [z.object({ mode: z.literal("manual"), questions: z.array(questionInput).min(1).max(200) }), z.object({ mode: z.literal("shuffle"), sourceVariantId: z.string().uuid() })]).safeParse(request.body);
    if (!params.success) return reply.code(400).send(validationError(params.error, "params"));
    if (!body.success) return reply.code(400).send(validationError(body.error));
    const result = await db.transaction(async (tx) => {
      const [quiz] = await tx.select().from(quizzes).where(and(eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted"), request.authUser!.role === "admin" ? undefined : eq(quizzes.teacherId, request.authUser!.id))).for("update").limit(1);
      if (!quiz) return null;
      const existing = await tx.select().from(quizVariants).where(eq(quizVariants.quizId, quiz.id)).orderBy(desc(quizVariants.code));
      let items: { type: string; prompt: string; options: string[]; correctOption: number | null; points: number }[];
      if (body.data.mode === "manual") items = body.data.questions;
      else {
        const sourceVariantId = body.data.sourceVariantId;
        if (!existing.some((variant) => variant.id === sourceVariantId && !variant.deleted)) return "variant_not_found" as const;
        const source = await tx.select().from(questions).where(eq(questions.variantId, sourceVariantId));
        const shuffle = <T,>(values: T[]) => { const copy = [...values]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; };
        items = source.map((item) => {
          const order = shuffle(item.options.map((_, index) => index));
          return { type: item.type, prompt: item.prompt, options: order.map((index) => item.options[index]), correctOption: item.correctOption === null ? null : order.indexOf(item.correctOption), points: item.points };
        });
        items = shuffle(items);
      }
      const [variant] = await tx.insert(quizVariants).values({ quizId: quiz.id, code: (existing[0]?.code ?? 100) + 1 }).returning();
      await tx.insert(questions).values(items.map((item, position) => ({ ...item, quizId: quiz.id, variantId: variant.id, position })));
      return variant;
    });
    if (result === "variant_not_found") return reply.code(404).send({ error: result });
    if (!result) return reply.code(404).send({ error: "not_found" });
    return reply.code(201).send({ variant: result });
  });

  app.put("/teacher/quizzes/:id/variants/:variantId", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid(), variantId: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ questions: z.array(questionInput).min(1).max(200), active: z.boolean() }).safeParse(request.body);
    if (!params.success) return reply.code(400).send(validationError(params.error, "params"));
    if (!body.success) return reply.code(400).send(validationError(body.error));
    const result = await db.transaction(async (tx) => {
      const [quiz] = await tx.select().from(quizzes).where(and(eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted"), request.authUser!.role === "admin" ? undefined : eq(quizzes.teacherId, request.authUser!.id))).for("update").limit(1);
      if (!quiz) return "missing";
      const variants = await tx.select().from(quizVariants).where(eq(quizVariants.quizId, quiz.id));
      if (!variants.some((variant) => variant.id === params.data.variantId && !variant.deleted)) return "missing";
      if (quiz.status === "active" && !body.data.active && !variants.some((variant) => variant.id !== params.data.variantId && variant.active && !variant.deleted)) return "last_active";
      await tx.update(quizVariants).set({ active: body.data.active }).where(eq(quizVariants.id, params.data.variantId));
      await tx.delete(questions).where(eq(questions.variantId, params.data.variantId));
      await tx.insert(questions).values(body.data.questions.map((item, position) => ({ ...item, quizId: quiz.id, variantId: params.data.variantId, position })));
      return "saved";
    });
    if (result === "missing") return reply.code(404).send({ error: "not_found" });
    if (result === "last_active") return reply.code(409).send({ error: "last_active_variant" });
    return { saved: true };
  });

  app.delete("/teacher/quizzes/:id/variants/:variantId", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid(), variantId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send(validationError(params.error, "params"));
    const outcome = await db.transaction(async (tx) => {
      const [quiz] = await tx.select().from(quizzes).where(and(eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted"), request.authUser!.role === "admin" ? undefined : eq(quizzes.teacherId, request.authUser!.id))).for("update").limit(1);
      if (!quiz) return "missing";
      const variants = await tx.select().from(quizVariants).where(and(eq(quizVariants.quizId, quiz.id), eq(quizVariants.deleted, false)));
      const variant = variants.find((item) => item.id === params.data.variantId);
      if (!variant) return "missing";
      if (variants.length === 1) return "last_variant";
      if (quiz.status === "active" && variant.active && !variants.some((item) => item.id !== variant.id && item.active)) return "last_active";
      const [used] = await tx.select({ id: submissions.id }).from(submissions).where(eq(submissions.variantId, variant.id)).limit(1);
      if (used) await tx.update(quizVariants).set({ deleted: true, active: false }).where(eq(quizVariants.id, variant.id));
      else { await tx.delete(questions).where(eq(questions.variantId, variant.id)); await tx.delete(quizVariants).where(eq(quizVariants.id, variant.id)); }
      return "deleted";
    });
    if (outcome === "missing") return reply.code(404).send({ error: "not_found" });
    if (outcome !== "deleted") return reply.code(409).send({ error: outcome });
    return reply.code(204).send();
  });

  app.post("/teacher/quizzes/:id/stop", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send(validationError(params.error, "params"));
    const filters = [eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted")];
    if (request.authUser!.role !== "admin") filters.push(eq(quizzes.teacherId, request.authUser!.id));
    const [updated] = await db.update(quizzes).set({ status: "inactive", updatedAt: new Date() }).where(and(...filters)).returning({ id: quizzes.id });
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return reply.code(204).send();
  });

  app.post("/teacher/quizzes/:id/extend-link", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ linkExpiresAt: z.string().datetime() }).safeParse(request.body);
    if (!params.success) return reply.code(400).send(validationError(params.error, "params"));
    if (!body.success) return reply.code(400).send(validationError(body.error));
    if (new Date(body.data.linkExpiresAt) <= new Date()) return reply.code(400).send({ error: "invalid_link_expiry" });
    const filters = [eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted")];
    if (request.authUser!.role !== "admin") filters.push(eq(quizzes.teacherId, request.authUser!.id));
    const [updated] = await db.update(quizzes).set({ linkExpiresAt: new Date(body.data.linkExpiresAt), updatedAt: new Date() }).where(and(...filters, eq(quizzes.status, "active"))).returning({ id: quizzes.id, linkExpiresAt: quizzes.linkExpiresAt });
    if (!updated) {
      const [existing] = await db.select({ status: quizzes.status }).from(quizzes).where(and(...filters)).limit(1);
      if (existing?.status === "inactive") return reply.code(409).send({ error: "quiz_closed" });
      return reply.code(404).send({ error: "not_found" });
    }
    return { quiz: updated };
  });

  app.post("/teacher/quizzes/:id/reopen", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ linkExpiresAt: z.string().datetime().optional() }).safeParse(request.body);
    if (!params.success) return reply.code(400).send(validationError(params.error, "params"));
    if (!body.success) return reply.code(400).send(validationError(body.error));
    if (body.data.linkExpiresAt && new Date(body.data.linkExpiresAt) <= new Date()) return reply.code(400).send({ error: "invalid_link_expiry" });
    const filters = [eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted")];
    if (request.authUser!.role !== "admin") filters.push(eq(quizzes.teacherId, request.authUser!.id));
    const [existing] = await db.select().from(quizzes).where(and(...filters)).limit(1);
    if (!existing) return reply.code(404).send({ error: "not_found" });
    if (existing.status === "active") return reply.code(409).send({ error: "quiz_already_open" });
    if (!body.data.linkExpiresAt && existing.linkExpiresAt && existing.linkExpiresAt <= new Date()) return reply.code(400).send({ error: "invalid_link_expiry" });
    const [enabledVariant] = await db.select({ id: quizVariants.id }).from(quizVariants).where(and(eq(quizVariants.quizId, existing.id), eq(quizVariants.active, true), eq(quizVariants.deleted, false))).limit(1);
    if (!enabledVariant) return reply.code(409).send({ error: "no_active_variant" });
    const [updated] = await db.update(quizzes).set({ status: "active", ...(body.data.linkExpiresAt ? { linkExpiresAt: new Date(body.data.linkExpiresAt) } : {}), updatedAt: new Date() }).where(and(...filters, eq(quizzes.status, "inactive"))).returning({ id: quizzes.id, status: quizzes.status, linkExpiresAt: quizzes.linkExpiresAt });
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return { quiz: updated };
  });

  app.delete("/teacher/quizzes/:id", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send(validationError(params.error, "params"));
    const filters = [eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted")];
    if (request.authUser!.role !== "admin") filters.push(eq(quizzes.teacherId, request.authUser!.id));
    const [deleted] = await db.update(quizzes).set({ status: "deleted", updatedAt: new Date() }).where(and(...filters)).returning({ id: quizzes.id });
    if (!deleted) return reply.code(404).send({ error: "not_found" });
    return reply.code(204).send();
  });

  app.post("/teacher/quizzes/:id/extend-attempts", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ additionalMinutes: z.number().int().min(1).max(1440) }).safeParse(request.body);
    if (!params.success) return reply.code(400).send(validationError(params.error, "params"));
    if (!body.success) return reply.code(400).send(validationError(body.error));
    const owner = await db.select({ id: quizzes.id }).from(quizzes).where(and(eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted"), request.authUser!.role === "admin" ? undefined : eq(quizzes.teacherId, request.authUser!.id))).limit(1);
    if (!owner.length) return reply.code(404).send({ error: "not_found" });
    await db.update(submissions).set({ dueAt: sql`${submissions.dueAt} + (${body.data.additionalMinutes} * interval '1 minute')` }).where(and(eq(submissions.quizId, params.data.id), isNull(submissions.submittedAt)));
    return { updated: true };
  });
}
