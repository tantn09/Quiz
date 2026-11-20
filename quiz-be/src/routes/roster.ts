import { createHash, randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { requireTeacherAccess } from "../auth.js";
import { db } from "../db/index.js";
import { accessRequests, quizzes, students, submissions, users } from "../db/schema.js";

const clean = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ");
export const identityKey = (value: string) => clean(value).toLocaleLowerCase("vi");
const nameInput = z.string().transform(clean).pipe(z.string().min(1).max(160));
const studentInput = z.object({ name: nameInput, className: z.string().transform(clean).pipe(z.string().min(1).max(80)) });
const idInput = z.object({ id: z.string().uuid() });
const upload = z.object({ filename: z.string().regex(/\.xlsx$/i), data: z.string().max(2_800_000), confirm: z.boolean().default(false) });
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const headers = ["Họ và tên", "Lớp"];
const identity = (teacherId: string, input: z.infer<typeof studentInput>) => ({ ...input, teacherId, nameKey: identityKey(input.name), classKey: identityKey(input.className) });
const owner = (user: { role: string; id: string }) => user.role === "admin" ? undefined : eq(quizzes.teacherId, user.id);
const rosterFields = { id: students.id, name: students.name, className: students.className, nameKey: students.nameKey };

const rosterQuery = z.object({ teacherId: z.string().uuid().optional() });

async function resolveRosterOwner(request: FastifyRequest, reply: FastifyReply) {
  const query = rosterQuery.safeParse(request.query);
  if (!query.success) { reply.code(400).send({ error: "invalid_request" }); return; }
  const user = request.authUser!;
  const teacherId = query.data.teacherId;
  if (!teacherId || teacherId === user.id) return user.id;
  if (user.role !== "admin") { reply.code(403).send({ error: "forbidden" }); return; }
  const [teacher] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, teacherId), eq(users.role, "teacher")));
  if (!teacher) { reply.code(404).send({ error: "teacher_not_found" }); return; }
  return teacher.id;
}

export async function rosterRoutes(app: FastifyInstance) {
  const protectedRoute = { preHandler: [requireTeacherAccess] };
  app.get("/teacher/students", protectedRoute, async (request, reply) => {
    const teacherId = await resolveRosterOwner(request, reply);
    if (!teacherId) return;
    return { students: await db.select(rosterFields).from(students).where(and(eq(students.teacherId, teacherId), eq(students.deleted, false))).orderBy(students.className, students.name) };
  });

  app.post("/teacher/students", protectedRoute, async (request, reply) => {
    const body = studentInput.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request" });
    const teacherId = await resolveRosterOwner(request, reply);
    if (!teacherId) return;
    const [student] = await db.insert(students).values(identity(teacherId, body.data)).onConflictDoUpdate({
      target: [students.teacherId, students.classKey, students.nameKey],
      set: { ...body.data, deleted: false }, setWhere: eq(students.deleted, true),
    }).returning(rosterFields);
    return student ? reply.code(201).send({ student }) : reply.code(409).send({ error: "duplicate_student" });
  });

  app.put("/teacher/students/:id", protectedRoute, async (request, reply) => {
    const params = idInput.safeParse(request.params);
    const body = studentInput.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    const teacherId = await resolveRosterOwner(request, reply);
    if (!teacherId) return;
    try {
      const [student] = await db.update(students).set(identity(teacherId, body.data)).where(and(eq(students.id, params.data.id), eq(students.teacherId, teacherId), eq(students.deleted, false))).returning(rosterFields);
      return student ? { student } : reply.code(404).send({ error: "not_found" });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ error: "duplicate_student" });
      throw error;
    }
  });

  app.delete("/teacher/students/:id", protectedRoute, async (request, reply) => {
    const params = idInput.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    const teacherId = await resolveRosterOwner(request, reply);
    if (!teacherId) return;
    const [student] = await db.update(students).set({ deleted: true }).where(and(eq(students.id, params.data.id), eq(students.teacherId, teacherId), eq(students.deleted, false))).returning({ id: students.id });
    return reply.code(student ? 204 : 404).send();
  });

  app.get("/teacher/students/template.xlsx", protectedRoute, async (_request, reply) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Học sinh");
    sheet.addRow(headers).font = { bold: true };
    sheet.getColumn(1).width = 35;
    sheet.getColumn(2).width = 18;
    sheet.getColumn(2).numFmt = "@";
    workbook.addWorksheet("Hướng dẫn").addRows([["Điền mỗi học sinh trên một dòng ở trang Học sinh."], ["Ví dụ", "Nguyễn Văn An", "9/7"]]);
    return reply.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").header("Content-Disposition", 'attachment; filename="hoc-sinh-mau.xlsx"').send(Buffer.from(await workbook.xlsx.writeBuffer()));
  });

  app.post("/teacher/students/import", { ...protectedRoute, bodyLimit: 3_000_000 }, async (request, reply) => {
    const teacherId = await resolveRosterOwner(request, reply);
    if (!teacherId) return;
    const body = upload.safeParse(request.body);
    const bytes = body.success ? Buffer.from(body.data.data, "base64") : Buffer.alloc(0);
    const invalid = () => reply.code(400).send({ errors: [{ row: 0, message: "Chỉ nhận file .xlsx hợp lệ tối đa 2 MB." }] });
    if (!body.success || bytes.length > 2_000_000 || bytes.toString("ascii", 0, 2) !== "PK") return invalid();
    const workbook = new ExcelJS.Workbook();
    try { await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]); } catch { return invalid(); }
    const sheet = workbook.getWorksheet("Học sinh");
    if (!sheet || headers.some((header, i) => sheet.getRow(1).getCell(i + 1).text !== header) || sheet.rowCount > 5001) {
      return reply.code(400).send({ errors: [{ row: 1, message: "Dùng đúng file mẫu và tối đa 5.000 dòng học sinh." }] });
    }
    const existing = await db.select().from(students).where(and(eq(students.teacherId, teacherId), eq(students.deleted, false)));
    const seen = new Set(existing.map((student) => JSON.stringify([student.classKey, student.nameKey])));
    const errors: { row: number; message: string }[] = [];
    const rows: ReturnType<typeof identity>[] = [];
    sheet.eachRow((row, index) => {
      if (index === 1) return;
      const [name, className] = [row.getCell(1).value, row.getCell(2).value];
      if (name == null && className == null) return;
      const input = studentInput.safeParse({ name, className: typeof className === "number" ? String(className) : className });
      if (!input.success) { errors.push({ row: index, message: "Điền họ tên và lớp, không dùng công thức." }); return; }
      const record = identity(teacherId, input.data);
      const key = JSON.stringify([record.classKey, record.nameKey]);
      if (seen.has(key)) { errors.push({ row: index, message: "Họ tên bị trùng trong lớp." }); return; }
      seen.add(key);
      rows.push(record);
    });
    if (errors.length || !rows.length) return reply.code(400).send({ count: rows.length, errors: errors.length ? errors : [{ row: 0, message: "File chưa có học sinh." }] });
    if (body.data.confirm) {
      try {
        await db.transaction(async (tx) => {
          for (const row of rows) {
            const inserted = await tx.insert(students).values(row).onConflictDoUpdate({ target: [students.teacherId, students.classKey, students.nameKey], set: { name: row.name, className: row.className, deleted: false }, setWhere: eq(students.deleted, true) }).returning({ id: students.id });
            if (!inserted.length) throw new Error("duplicate_student");
          }
        });
      } catch (error) {
        if (error instanceof Error && error.message === "duplicate_student") return reply.code(409).send({ errors: [{ row: 0, message: "Danh sách đã thay đổi. Hãy xem trước lại." }] });
        throw error;
      }
    }
    return { count: rows.length };
  });

  app.get("/teacher/quizzes/:id/roster", protectedRoute, async (request, reply) => {
    const params = idInput.safeParse(request.params);
    if (!params.success) return reply.code(400).send();
    const [quiz] = await db.select().from(quizzes).where(and(eq(quizzes.id, params.data.id), owner(request.authUser!), ne(quizzes.status, "deleted")));
    if (!quiz) return reply.code(404).send();
    const members = quiz.assignedClass ? await db.select(rosterFields).from(students).where(and(eq(students.teacherId, quiz.teacherId), eq(students.classKey, identityKey(quiz.assignedClass)), eq(students.deleted, false))).orderBy(students.name) : [];
    const attempts = await db.select({ studentId: submissions.studentId, nameKey: submissions.studentNameKey }).from(submissions).where(and(eq(submissions.quizId, quiz.id), quiz.assignedClass ? eq(submissions.studentClassKey, identityKey(quiz.assignedClass)) : undefined));
    const requests = await db.select({ id: accessRequests.id, name: accessRequests.name, status: accessRequests.status }).from(accessRequests).where(eq(accessRequests.quizId, quiz.id)).orderBy(accessRequests.name);
    return { assignedClass: quiz.assignedClass, count: members.length, notStarted: members.filter((member) => !attempts.some((attempt) => attempt.studentId ? attempt.studentId === member.id : attempt.nameKey === member.nameKey)), requests };
  });

  app.patch("/teacher/access-requests/:id", protectedRoute, async (request, reply) => {
    const params = idInput.safeParse(request.params);
    const body = z.object({ status: z.enum(["approved", "rejected"]) }).safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send();
    const status = body.data.status;
    const result = await db.transaction(async (tx) => {
      const [row] = await tx.select({ item: accessRequests, quiz: quizzes }).from(accessRequests).innerJoin(quizzes, eq(quizzes.id, accessRequests.quizId)).where(and(eq(accessRequests.id, params.data.id), owner(request.authUser!), ne(quizzes.status, "deleted"))).for("update", { of: accessRequests });
      if (!row || !row.quiz.assignedClass) return 404;
      if (row.item.status === status) return 200;
      if (row.item.status !== "pending") return 409;
      if (status === "approved") {
        await tx.insert(students).values(identity(row.quiz.teacherId, { name: row.item.name, className: row.quiz.assignedClass })).onConflictDoUpdate({
          target: [students.teacherId, students.classKey, students.nameKey], set: { deleted: false }, setWhere: eq(students.deleted, true),
        });
      }
      await tx.update(accessRequests).set({ status }).where(eq(accessRequests.id, row.item.id));
      return 200;
    });
    return reply.code(result).send({ status: result === 200 ? status : undefined });
  });

  app.post("/public/quizzes/:token/access-requests", async (request, reply) => {
    const params = z.object({ token: z.string().min(20).max(80) }).safeParse(request.params);
    const body = z.object({ name: nameInput }).safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send();
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.linkToken, params.data.token));
    if (!quiz?.assignedClass || quiz.status !== "active" || (quiz.linkExpiresAt && quiz.linkExpiresAt <= new Date())) return reply.code(410).send();
    const nameKey = identityKey(body.data.name);
    const members = await db.select({ nameKey: students.nameKey }).from(students).where(and(eq(students.teacherId, quiz.teacherId), eq(students.classKey, identityKey(quiz.assignedClass)), eq(students.deleted, false)));
    if (!members.length || members.some((member) => member.nameKey === nameKey)) return reply.code(409).send({ error: "can_start" });
    const receipt = randomBytes(32).toString("base64url");
    const [item] = await db.insert(accessRequests).values({ quizId: quiz.id, name: body.data.name, nameKey, receiptHash: hash(receipt) }).onConflictDoNothing().returning({ id: accessRequests.id });
    return item ? reply.code(201).send({ receipt, status: "pending" }) : reply.code(409).send({ error: "request_exists" });
  });

  app.get("/public/quizzes/:token/access-request", async (request, reply) => {
    const params = z.object({ token: z.string().min(20).max(80) }).safeParse(request.params);
    const receipt = request.headers["x-request-receipt"];
    if (!params.success || typeof receipt !== "string" || !/^[\w-]{43}$/.test(receipt)) return reply.code(404).send();
    const [item] = await db.select({ status: accessRequests.status }).from(accessRequests).innerJoin(quizzes, eq(quizzes.id, accessRequests.quizId)).where(and(eq(quizzes.linkToken, params.data.token), eq(accessRequests.receiptHash, hash(receipt))));
    return item ?? reply.code(404).send();
  });
}
