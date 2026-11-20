import type { FastifyInstance } from "fastify";
import { and, count, eq, gt, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { requireTeacherAccess } from "../auth.js";
import { db } from "../db/index.js";
import { accessRequests, quizzes, students, submissions, users } from "../db/schema.js";

const timeZone = "Asia/Ho_Chi_Minh";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard/overview", { preHandler: [requireTeacherAccess] }, async (request, reply) => {
    const user = request.authUser!;
    const admin = user.role === "admin";
    const now = new Date();
    const visibleQuizzes = and(ne(quizzes.status, "deleted"), admin ? undefined : eq(quizzes.teacherId, user.id));
    const submitted = and(visibleQuizzes, isNotNull(submissions.submittedAt));
    const dateKey = sql<string>`to_char(${submissions.submittedAt} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`;
    const localToday = sql`(${now.toISOString()}::timestamptz AT TIME ZONE ${timeZone})::date`;

    const [[quizStats], [studentStats], [resultStats], daily, roleStats] = await Promise.all([
      db.select({
        total: count(),
        open: sql<number>`count(*) filter (where ${and(eq(quizzes.status, "active"), or(isNull(quizzes.linkExpiresAt), gt(quizzes.linkExpiresAt, now)))})`.mapWith(Number),
      }).from(quizzes).where(visibleQuizzes),
      db.select({ total: count() }).from(students).where(and(eq(students.deleted, false), admin ? undefined : eq(students.teacherId, user.id))),
      db.select({
        submitted: count(),
        needsReview: sql<number>`count(*) filter (where ${ne(submissions.gradingStatus, "graded")})`.mapWith(Number),
      }).from(submissions).innerJoin(quizzes, eq(submissions.quizId, quizzes.id)).where(submitted),
      db.select({ date: dateKey, count: count() }).from(submissions).innerJoin(quizzes, eq(submissions.quizId, quizzes.id)).where(and(
        submitted,
        sql`${submissions.submittedAt} >= ((${localToday} - 6)::timestamp AT TIME ZONE ${timeZone})`,
        sql`${submissions.submittedAt} < ((${localToday} + 1)::timestamp AT TIME ZONE ${timeZone})`,
      )).groupBy(sql`1`),
      admin
        ? db.select({ teachers: count(), pendingTeachers: sql<number>`count(*) filter (where ${eq(users.status, "pending")})`.mapWith(Number) }).from(users).where(eq(users.role, "teacher"))
        : db.select({ pendingRequests: count() }).from(accessRequests).innerJoin(quizzes, eq(accessRequests.quizId, quizzes.id)).where(and(visibleQuizzes, eq(accessRequests.status, "pending"))),
    ]);

    const today = new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const dailyCounts = new Map(daily.map(({ date, count }) => [date, count]));
    const submissionsByDay = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today + "T00:00:00Z");
      date.setUTCDate(date.getUTCDate() - 6 + index);
      const key = date.toISOString().slice(0, 10);
      return { date: key, count: dailyCounts.get(key) ?? 0 };
    });

    reply.header("Cache-Control", "private, no-store");
    return {
      role: user.role,
      metrics: { students: studentStats.total, quizzes: quizStats.total, openQuizzes: quizStats.open, ...resultStats, ...roleStats[0] },
      submissionsByDay,
    };
  });
}
