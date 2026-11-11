import type { FastifyInstance } from "fastify";
import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../auth.js";
import { db } from "../db/index.js";
import { sessions, users } from "../db/schema.js";
import { hashPassword } from "../password.js";

const teacherInput = z.object({ username: z.string().trim().min(3).max(80), displayName: z.string().trim().min(1).max(160), password: z.string().min(10).max(200) });
const editInput = z.object({ displayName: z.string().trim().min(1).max(160).optional(), status: z.enum(["active", "locked"]).optional() });

export async function teacherRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/teachers", { preHandler: [requireAdmin] }, async (request) => {
    const query = z.object({ search: z.string().trim().max(100).optional(), status: z.enum(["active", "locked"]).optional() }).parse(request.query);
    const conditions = [eq(users.role, "teacher")];
    if (query.search) conditions.push(or(ilike(users.username, `%${query.search}%`), ilike(users.displayName, `%${query.search}%`))!);
    if (query.status) conditions.push(eq(users.status, query.status));
    return { teachers: await db.select({ id: users.id, username: users.username, displayName: users.displayName, status: users.status, createdAt: users.createdAt }).from(users).where(and(...conditions)).orderBy(users.displayName) };
  });

  app.post("/admin/teachers", { preHandler: [requireAdmin] }, async (request, reply) => {
    const parsed = teacherInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    let created;
    try {
      [created] = await db.insert(users).values({ username: parsed.data.username, displayName: parsed.data.displayName, passwordHash: await hashPassword(parsed.data.password), role: "teacher" })
        .returning({ id: users.id, username: users.username, displayName: users.displayName, status: users.status });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return reply.code(409).send({ error: "username_exists" });
      throw error;
    }
    return reply.code(201).send({ teacher: created });
  });

  app.patch("/admin/teachers/:id", { preHandler: [requireAdmin] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = editInput.safeParse(request.body);
    if (!params.success || !body.success || Object.keys(body.data).length === 0) return reply.code(400).send({ error: "invalid_request" });
    const [updated] = await db.update(users).set({ ...body.data, updatedAt: new Date() })
      .where(and(eq(users.id, params.data.id), eq(users.role, "teacher")))
      .returning({ id: users.id, username: users.username, displayName: users.displayName, status: users.status });
    if (!updated) return reply.code(404).send({ error: "not_found" });
    if (body.data.status === "locked") await db.delete(sessions).where(eq(sessions.userId, updated.id));
    return { teacher: updated };
  });

  app.post("/admin/teachers/:id/reset-password", { preHandler: [requireAdmin] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ password: z.string().min(10).max(200) }).safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    const changed = await db.update(users).set({ passwordHash: await hashPassword(body.data.password), updatedAt: new Date() })
      .where(and(eq(users.id, params.data.id), eq(users.role, "teacher"))).returning({ id: users.id });
    if (!changed.length) return reply.code(404).send({ error: "not_found" });
    await db.delete(sessions).where(eq(sessions.userId, params.data.id));
    return reply.code(204).send();
  });
}
