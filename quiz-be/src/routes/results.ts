import ExcelJS from "exceljs";
import type { FastifyInstance } from "fastify";
import { and, desc, eq, ilike, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { requireTeacherAccess } from "../auth.js";
import { db } from "../db/index.js";
import { answers, quizzes, quizVariants, submissions } from "../db/schema.js";

function ownerFilter(user: { id: string; role: string }) {
  return user.role === "admin" ? undefined : eq(quizzes.teacherId, user.id);
}

export async function resultRoutes(app: FastifyInstance): Promise<void> {
  app.get("/teacher/results/summary", { preHandler: [requireTeacherAccess] }, async (request) => {
    const owner = ownerFilter(request.authUser!);
    const visible = and(owner, ne(quizzes.status, "deleted"));
    const [quizRows, counts] = await Promise.all([
      db.select({ id: quizzes.id, title: quizzes.title, assignedClass: quizzes.assignedClass }).from(quizzes).where(visible),
      db.select({
        quizId: quizzes.id, quizTitle: quizzes.title, className: submissions.studentClass,
        inProgress: sql<number>`count(*) filter (where ${submissions.submittedAt} is null)`.mapWith(Number),
        submitted: sql<number>`count(${submissions.submittedAt})`.mapWith(Number),
        needsReview: sql<number>`count(*) filter (where ${submissions.submittedAt} is not null and ${submissions.gradingStatus} <> 'graded')`.mapWith(Number),
        graded: sql<number>`count(*) filter (where ${submissions.submittedAt} is not null and ${submissions.gradingStatus} = 'graded')`.mapWith(Number),
      }).from(submissions).innerJoin(quizzes, eq(submissions.quizId, quizzes.id)).where(visible)
        .groupBy(quizzes.id, quizzes.title, submissions.studentClass),
    ]);
    const groups = new Map(counts.map((row) => [JSON.stringify([row.quizId, row.className]), row]));
    for (const quiz of quizRows) {
      if (!quiz.assignedClass) continue;
      const key = JSON.stringify([quiz.id, quiz.assignedClass]);
      if (!groups.has(key)) groups.set(key, { quizId: quiz.id, quizTitle: quiz.title, className: quiz.assignedClass, inProgress: 0, submitted: 0, needsReview: 0, graded: 0 });
    }
    return { groups: [...groups.values()].sort((a, b) => a.className.localeCompare(b.className, "vi") || a.quizTitle.localeCompare(b.quizTitle, "vi")) };
  });

  app.get("/teacher/results", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const query = z.object({ scope: z.literal("group").optional(), quizId: z.string().uuid().optional(), className: z.string().max(80).optional(), search: z.string().trim().max(100).optional(), gradingStatus: z.enum(["pending", "needs_review", "graded"]).optional() }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_request" });
    const filters = [];
    const owner = ownerFilter(request.authUser!);
    if (owner) filters.push(owner);
    if (query.data.quizId) filters.push(eq(quizzes.id, query.data.quizId));
    if (!query.data.scope && query.data.className?.trim()) filters.push(eq(submissions.studentClass, query.data.className.trim()));
    if (query.data.gradingStatus) filters.push(eq(submissions.gradingStatus, query.data.gradingStatus));
    if (query.data.search) filters.push(or(ilike(submissions.studentName, `%${query.data.search}%`), ilike(submissions.studentClass, `%${query.data.search}%`), ilike(quizzes.title, `%${query.data.search}%`))!);
    const fields = { id: submissions.id, studentName: submissions.studentName, studentClass: submissions.studentClass, submittedAt: submissions.submittedAt, score: submissions.score, gradingStatus: submissions.gradingStatus, quizId: quizzes.id, quizTitle: quizzes.title, variantCode: quizVariants.code };
    if (query.data.scope === "group") {
      if (!query.data.quizId || query.data.className === undefined) return reply.code(400).send({ error: "invalid_request" });
      const results = await db.select({
        ...fields,
        maxScore: sql<number>`coalesce((select sum((item->>'points')::numeric) from jsonb_array_elements(${submissions.questionSnapshot}) as item), 0)`.mapWith(Number),
      }).from(submissions).innerJoin(quizzes, eq(submissions.quizId, quizzes.id))
        .innerJoin(quizVariants, eq(submissions.variantId, quizVariants.id))
        .where(and(...filters, eq(submissions.studentClass, query.data.className), ne(quizzes.status, "deleted")))
        .orderBy(desc(submissions.submittedAt));
      return { results };
    }
    const rows = await db.select({ ...fields, questionSnapshot: submissions.questionSnapshot })
      .from(submissions).innerJoin(quizzes, eq(submissions.quizId, quizzes.id)).innerJoin(quizVariants, eq(submissions.variantId, quizVariants.id)).where(filters.length ? and(...filters) : undefined).orderBy(desc(submissions.submittedAt));
    const quizList = await db.select({ id: quizzes.id, title: quizzes.title }).from(quizzes).where(owner);
    const classes = await db.selectDistinct({ quizId: quizzes.id, name: submissions.studentClass }).from(submissions).innerJoin(quizzes, eq(submissions.quizId, quizzes.id)).where(owner);
    return { results: rows.map(({ questionSnapshot, ...row }) => ({ ...row, maxScore: questionSnapshot.reduce((sum, question) => sum + question.points, 0) })), quizzes: quizList.map((quiz) => ({ ...quiz, classes: classes.filter((item) => item.quizId === quiz.id).map((item) => item.name) })) };
  });

  app.get("/teacher/results/:id", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    const [row] = await db.select({ submission: submissions, quizTitle: quizzes.title, teacherId: quizzes.teacherId }).from(submissions)
      .innerJoin(quizzes, eq(submissions.quizId, quizzes.id)).where(eq(submissions.id, params.data.id)).limit(1);
    if (!row || (request.authUser!.role !== "admin" && row.teacherId !== request.authUser!.id)) return reply.code(404).send({ error: "not_found" });
    const responseAnswers = await db.select().from(answers).where(eq(answers.submissionId, row.submission.id));
    const [variant] = await db.select({ code: quizVariants.code }).from(quizVariants).where(eq(quizVariants.id, row.submission.variantId!)).limit(1);
    return { submission: { ...row.submission, quizTitle: row.quizTitle, variantCode: variant?.code, maxScore: row.submission.questionSnapshot.reduce((sum, question) => sum + question.points, 0) }, answers: responseAnswers };
  });

  app.patch("/teacher/results/:id/grade", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ scores: z.record(z.string().uuid(), z.number().min(0).max(1000).multipleOf(0.25)) }).safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    const result = await db.transaction(async (tx) => {
      const [row] = await tx.select({ submission: submissions }).from(submissions)
        .innerJoin(quizzes, eq(submissions.quizId, quizzes.id))
        .where(and(eq(submissions.id, params.data.id), ownerFilter(request.authUser!), isNotNull(submissions.submittedAt)))
        .for("update", { of: submissions });
      if (!row) return { error: "not_found" } as const;
      const questions = row.submission.questionSnapshot;
      const essays = new Map(questions.filter((question) => question.type === "essay").map((question) => [question.id, question]));
      for (const [id, award] of Object.entries(body.data.scores)) {
        const question = essays.get(id);
        if (!question) return { error: "invalid_question" } as const;
        if (award > question.points) return { error: "score_exceeds_points" } as const;
      }
      for (const [questionId, awardedPoints] of Object.entries(body.data.scores)) {
        await tx.insert(answers).values({ submissionId: row.submission.id, questionId, awardedPoints })
          .onConflictDoUpdate({ target: [answers.submissionId, answers.questionId], set: { awardedPoints, updatedAt: new Date() } });
      }
      const saved = await tx.select().from(answers).where(eq(answers.submissionId, row.submission.id));
      const byQuestion = new Map(saved.map((answer) => [answer.questionId, answer.awardedPoints]));
      const score = questions.reduce((total, question) => total + (byQuestion.get(question.id) ?? 0), 0);
      const gradingStatus = [...essays.keys()].some((id) => byQuestion.get(id) == null) ? "needs_review" : "graded";
      await tx.update(submissions).set({ score, gradingStatus }).where(eq(submissions.id, row.submission.id));
      return { saved: true, score, gradingStatus };
    });
    return result.error ? reply.code(result.error === "not_found" ? 404 : 400).send(result) : result;
  });

  app.delete("/teacher/results/:id", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    const [deleted] = await db.delete(submissions).where(and(eq(submissions.id, params.data.id), isNotNull(submissions.submittedAt), inArray(submissions.quizId, db.select({ id: quizzes.id }).from(quizzes).where(and(ownerFilter(request.authUser!), ne(quizzes.status, "deleted")))))).returning({ id: submissions.id });
    if (!deleted) return reply.code(404).send({ error: "not_found" });
    return reply.code(204).send();
  });

  app.delete("/teacher/quizzes/:id/results", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const query = z.object({ className: z.string().trim().min(1).max(80) }).safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ error: "invalid_request" });
    const [quiz] = await db.select({ id: quizzes.id, assignedClass: quizzes.assignedClass }).from(quizzes).where(and(eq(quizzes.id, params.data.id), ne(quizzes.status, "deleted"), ownerFilter(request.authUser!))).limit(1);
    if (!quiz || (quiz.assignedClass && quiz.assignedClass !== query.data.className)) return reply.code(404).send({ error: "not_found" });
    const deleted = await db.delete(submissions).where(and(eq(submissions.quizId, quiz.id), eq(submissions.studentClass, query.data.className), isNotNull(submissions.submittedAt))).returning({ id: submissions.id });
    return { deleted: deleted.length };
  });

  app.get("/teacher/quizzes/:id/results.xlsx", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const query = z.object({ className: z.string().trim().max(80).optional() }).safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ error: "invalid_request" });
    const [quiz] = await db.select().from(quizzes).where(and(eq(quizzes.id, params.data.id), ownerFilter(request.authUser!))).limit(1);
    if (!quiz) return reply.code(404).send({ error: "not_found" });
    const rows = await db.select({ submission: submissions, variantCode: quizVariants.code }).from(submissions).innerJoin(quizVariants, eq(submissions.variantId, quizVariants.id)).where(and(eq(submissions.quizId, quiz.id), isNotNull(submissions.submittedAt), query.data.className ? eq(submissions.studentClass, query.data.className) : undefined)).orderBy(desc(submissions.submittedAt));
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Kết quả");
    const english = request.authUser!.language === "en";
    sheet.columns = [
      { header: english ? "Student name" : "Họ và tên", key: "studentName", width: 28 },
      { header: english ? "Class" : "Lớp", key: "studentClass", width: 16 },
      { header: english ? "Submitted at" : "Thời điểm nộp", key: "submittedAt", width: 24 },
      { header: english ? "Score" : "Điểm", key: "score", width: 12 },
      { header: english ? "Grading status" : "Trạng thái chấm", key: "gradingStatus", width: 20 },
      { header: english ? "Variant" : "Mã đề", key: "variantCode", width: 12 },
      { header: english ? "Maximum score" : "Tổng điểm", key: "maxScore", width: 14 },
    ];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow({
      studentName: row.submission.studentName,
      studentClass: row.submission.studentClass,
      submittedAt: row.submission.submittedAt?.toISOString() ?? "",
      score: row.submission.score ?? "",
      gradingStatus: english ? ({ pending: "Pending", needs_review: "Needs grading", graded: "Graded" }[row.submission.gradingStatus] ?? row.submission.gradingStatus) : { pending: "Chờ nộp", needs_review: "Cần chấm", graded: "Đã chấm" }[row.submission.gradingStatus],
      variantCode: row.variantCode,
      maxScore: row.submission.questionSnapshot.reduce((sum, question) => sum + question.points, 0),
    }));
    const file = Buffer.from(await workbook.xlsx.writeBuffer());
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", `attachment; filename="quiz-${quiz.id}-results.xlsx"`);
    return reply.send(file);
  });
}
