import ExcelJS from "exceljs";
import type { FastifyInstance } from "fastify";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { requireTeacherAccess } from "../auth.js";
import { db } from "../db/index.js";
import { answers, quizzes, submissions } from "../db/schema.js";

function ownerFilter(user: { id: string; role: string }) {
  return user.role === "admin" ? undefined : eq(quizzes.teacherId, user.id);
}

export async function resultRoutes(app: FastifyInstance): Promise<void> {
  app.get("/teacher/results", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const query = z.object({ quizId: z.string().uuid().optional(), search: z.string().trim().max(100).optional(), gradingStatus: z.enum(["pending", "needs_review", "graded"]).optional() }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_request" });
    const filters = [];
    const owner = ownerFilter(request.authUser!);
    if (owner) filters.push(owner);
    if (query.data.quizId) filters.push(eq(quizzes.id, query.data.quizId));
    if (query.data.gradingStatus) filters.push(eq(submissions.gradingStatus, query.data.gradingStatus));
    if (query.data.search) filters.push(or(ilike(submissions.studentName, `%${query.data.search}%`), ilike(submissions.studentClass, `%${query.data.search}%`), ilike(quizzes.title, `%${query.data.search}%`))!);
    const rows = await db.select({ id: submissions.id, studentName: submissions.studentName, studentClass: submissions.studentClass, submittedAt: submissions.submittedAt, score: submissions.score, gradingStatus: submissions.gradingStatus, quizId: quizzes.id, quizTitle: quizzes.title })
      .from(submissions).innerJoin(quizzes, eq(submissions.quizId, quizzes.id)).where(filters.length ? and(...filters) : undefined).orderBy(desc(submissions.submittedAt));
    const quizList = await db.select({ id: quizzes.id, title: quizzes.title }).from(quizzes).where(owner);
    return { results: rows, quizzes: quizList };
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

  app.get("/teacher/quizzes/:id/results.xlsx", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    const [quiz] = await db.select().from(quizzes).where(and(eq(quizzes.id, params.data.id), ownerFilter(request.authUser!))).limit(1);
    if (!quiz) return reply.code(404).send({ error: "not_found" });
    const rows = await db.select().from(submissions).where(eq(submissions.quizId, quiz.id)).orderBy(desc(submissions.submittedAt));
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
