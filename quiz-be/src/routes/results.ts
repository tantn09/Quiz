import ExcelJS from "exceljs";
import type { FastifyInstance } from "fastify";
import { and, desc, eq, ilike, inArray, isNotNull, ne, or } from "drizzle-orm";
import { z } from "zod";
import { requireTeacherAccess } from "../auth.js";
import { db } from "../db/index.js";
import { answers, quizzes, submissions } from "../db/schema.js";

function ownerFilter(user: { id: string; role: string }) {
  return user.role === "admin" ? undefined : eq(quizzes.teacherId, user.id);
}

export async function resultRoutes(app: FastifyInstance): Promise<void> {
  app.get("/teacher/results/summary", { preHandler: [requireTeacherAccess] }, async (request) => {
    const owner = ownerFilter(request.authUser!);
    const quizRows = await db.select({ id: quizzes.id, title: quizzes.title, assignedClass: quizzes.assignedClass }).from(quizzes).where(and(owner, ne(quizzes.status, "deleted"))).orderBy(quizzes.title);
    const attemptRows = await db.select({ quizId: submissions.quizId, studentClass: submissions.studentClass, submittedAt: submissions.submittedAt, gradingStatus: submissions.gradingStatus }).from(submissions).innerJoin(quizzes, eq(submissions.quizId, quizzes.id)).where(and(owner, ne(quizzes.status, "deleted")));
    const groups = new Map<string, { quizId: string; quizTitle: string; className: string; inProgress: number; submitted: number; needsReview: number; graded: number }>();
    for (const quiz of quizRows) if (quiz.assignedClass) groups.set(`${quiz.id}\u0000${quiz.assignedClass}`, { quizId: quiz.id, quizTitle: quiz.title, className: quiz.assignedClass, inProgress: 0, submitted: 0, needsReview: 0, graded: 0 });
    for (const row of attemptRows) {
      const quiz = quizRows.find((item) => item.id === row.quizId);
      if (!quiz) continue;
      const key = `${quiz.id}\u0000${row.studentClass}`;
      let group = groups.get(key);
      if (!group) { group = { quizId: quiz.id, quizTitle: quiz.title, className: row.studentClass, inProgress: 0, submitted: 0, needsReview: 0, graded: 0 }; groups.set(key, group); }
      if (!row.submittedAt) group.inProgress++;
      else { group.submitted++; if (row.gradingStatus === "graded") group.graded++; else group.needsReview++; }
    }
    return { groups: [...groups.values()].sort((a, b) => a.className.localeCompare(b.className, "vi") || a.quizTitle.localeCompare(b.quizTitle, "vi")) };
  });

  app.get("/teacher/results", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const query = z.object({ quizId: z.string().uuid().optional(), className: z.string().trim().max(80).optional(), search: z.string().trim().max(100).optional(), gradingStatus: z.enum(["pending", "needs_review", "graded"]).optional() }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_request" });
    const filters = [];
    const owner = ownerFilter(request.authUser!);
    if (owner) filters.push(owner);
    if (query.data.quizId) filters.push(eq(quizzes.id, query.data.quizId));
    if (query.data.className) filters.push(eq(submissions.studentClass, query.data.className));
    if (query.data.gradingStatus) filters.push(eq(submissions.gradingStatus, query.data.gradingStatus));
    if (query.data.search) filters.push(or(ilike(submissions.studentName, `%${query.data.search}%`), ilike(submissions.studentClass, `%${query.data.search}%`), ilike(quizzes.title, `%${query.data.search}%`))!);
    const rows = await db.select({ id: submissions.id, studentName: submissions.studentName, studentClass: submissions.studentClass, submittedAt: submissions.submittedAt, score: submissions.score, gradingStatus: submissions.gradingStatus, quizId: quizzes.id, quizTitle: quizzes.title })
      .from(submissions).innerJoin(quizzes, eq(submissions.quizId, quizzes.id)).where(filters.length ? and(...filters) : undefined).orderBy(desc(submissions.submittedAt));
    const quizList = await db.select({ id: quizzes.id, title: quizzes.title }).from(quizzes).where(owner);
    const classes = await db.selectDistinct({ quizId: quizzes.id, name: submissions.studentClass }).from(submissions).innerJoin(quizzes, eq(submissions.quizId, quizzes.id)).where(owner);
    return { results: rows, quizzes: quizList.map((quiz) => ({ ...quiz, classes: classes.filter((item) => item.quizId === quiz.id).map((item) => item.name) })) };
  });

  app.get("/teacher/results/:id", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    const [row] = await db.select({ submission: submissions, quizTitle: quizzes.title, teacherId: quizzes.teacherId }).from(submissions)
      .innerJoin(quizzes, eq(submissions.quizId, quizzes.id)).where(eq(submissions.id, params.data.id)).limit(1);
    if (!row || (request.authUser!.role !== "admin" && row.teacherId !== request.authUser!.id)) return reply.code(404).send({ error: "not_found" });
    const responseAnswers = await db.select().from(answers).where(eq(answers.submissionId, row.submission.id));
    return { submission: { ...row.submission, quizTitle: row.quizTitle }, answers: responseAnswers };
  });

  app.patch("/teacher/results/:id/grade", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ scores: z.record(z.string().uuid(), z.number().int().min(0).max(1000)) }).safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    const [row] = await db.select({ submission: submissions, teacherId: quizzes.teacherId }).from(submissions)
      .innerJoin(quizzes, eq(submissions.quizId, quizzes.id)).where(eq(submissions.id, params.data.id)).limit(1);
    if (!row || (request.authUser!.role !== "admin" && row.teacherId !== request.authUser!.id)) return reply.code(404).send({ error: "not_found" });
    const essayIds = new Set(row.submission.questionSnapshot.filter((question) => question.type === "essay").map((question) => question.id));
    if (Object.keys(body.data.scores).some((id) => !essayIds.has(id))) return reply.code(400).send({ error: "invalid_question" });
    for (const question of row.submission.questionSnapshot.filter((item) => item.type === "essay")) {
      const score = body.data.scores[question.id];
      if (score !== undefined && score > question.points) return reply.code(400).send({ error: "score_exceeds_points" });
    }
    const currentAnswers = await db.select().from(answers).where(eq(answers.submissionId, row.submission.id));
    let essayMissing = false;
    await db.transaction(async (tx) => {
      for (const [questionId, awardedPoints] of Object.entries(body.data.scores)) {
        await tx.update(answers).set({ awardedPoints, updatedAt: new Date() }).where(and(eq(answers.submissionId, row.submission.id), eq(answers.questionId, questionId)));
      }
      const byQuestion = new Map(currentAnswers.map((answer) => [answer.questionId, answer]));
      let score = 0;
      for (const question of row.submission.questionSnapshot) {
        if (question.type === "essay") {
          const award = body.data.scores[question.id] ?? byQuestion.get(question.id)?.awardedPoints;
          if (award === null || award === undefined) essayMissing = true;
          else score += award;
        } else score += byQuestion.get(question.id)?.awardedPoints ?? 0;
      }
      await tx.update(submissions).set({ score, gradingStatus: essayMissing ? "needs_review" : "graded" }).where(eq(submissions.id, row.submission.id));
    });
    return { saved: true, gradingStatus: essayMissing ? "needs_review" : "graded" };
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
    const rows = await db.select().from(submissions).where(and(eq(submissions.quizId, quiz.id), isNotNull(submissions.submittedAt), query.data.className ? eq(submissions.studentClass, query.data.className) : undefined)).orderBy(desc(submissions.submittedAt));
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Kết quả");
    const english = request.authUser!.language === "en";
    sheet.columns = [
      { header: english ? "Student name" : "Họ và tên", key: "studentName", width: 28 },
      { header: english ? "Class" : "Lớp", key: "studentClass", width: 16 },
      { header: english ? "Submitted at" : "Thời điểm nộp", key: "submittedAt", width: 24 },
      { header: english ? "Score" : "Điểm", key: "score", width: 12 },
      { header: english ? "Grading status" : "Trạng thái chấm", key: "gradingStatus", width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow({
      studentName: row.studentName,
      studentClass: row.studentClass,
      submittedAt: row.submittedAt?.toISOString() ?? "",
      score: row.score ?? "",
      gradingStatus: english ? ({ pending: "Pending", needs_review: "Needs grading", graded: "Graded" }[row.gradingStatus] ?? row.gradingStatus) : row.gradingStatus,
    }));
    const file = Buffer.from(await workbook.xlsx.writeBuffer());
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", `attachment; filename="quiz-${quiz.id}-results.xlsx"`);
    return reply.send(file);
  });
}
