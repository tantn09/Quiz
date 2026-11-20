import { invalidTeacherCatalogField } from "./catalogs.js";
import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authenticate, createSession, requireUser, SESSION_COOKIE, tokenDigest } from "../auth.js";
import { db } from "../db/index.js";
import { sessions, users } from "../db/schema.js";
import { uniqueConstraint } from "../db/pg-error.js";
import { hashPassword, verifyPassword } from "../password.js";

const loginBody = z.object({ username: z.string().trim().min(1).max(80), password: z.string().min(1).max(200) });
const registerBody = z.object({ username: z.string().trim().min(3).max(80), displayName: z.string().trim().min(1).max(160), email: z.string().trim().email().max(254), password: z.string().min(10).max(200), subject: z.string().trim().max(120).optional(), workplace: z.string().trim().max(200).optional() });

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/register", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = registerBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    const field = await invalidTeacherCatalogField(parsed.data);
    if (field) return reply.code(400).send({ error: "invalid_catalog_selection", field });
    try {
      await db.insert(users).values({ username: parsed.data.username, displayName: parsed.data.displayName, email: parsed.data.email.toLowerCase(), subject: parsed.data.subject || null, workplace: parsed.data.workplace || null, passwordHash: await hashPassword(parsed.data.password), role: "teacher", status: "pending" });
    } catch (error) {
      const constraint = uniqueConstraint(error);
      if (constraint) return reply.code(409).send({ error: constraint === "users_email_unique" ? "email_exists" : "username_exists" });
      throw error;
    }
    return reply.code(201).send({ status: "pending" });
  });

  app.post("/auth/login", { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const [user] = await db.select().from(users).where(eq(users.username, parsed.data.username)).limit(1);
    if (!user || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    if (user.status === "pending") return reply.code(403).send({ error: "pending_approval" });
    if (user.status !== "active") return reply.code(401).send({ error: "invalid_credentials" });
    await createSession(user.id, reply);
    return { user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, language: user.language, theme: user.theme } };
  });

  app.get("/auth/me", { preHandler: [authenticate, requireUser] }, async (request) => {
    const [user] = await db.select({ id: users.id, username: users.username, displayName: users.displayName, email: users.email, subject: users.subject, workplace: users.workplace, role: users.role, language: users.language, theme: users.theme })
      .from(users).where(eq(users.id, request.authUser!.id)).limit(1);
    return { user };
  });

  app.patch("/auth/profile", { preHandler: [authenticate, requireUser] }, async (request, reply) => {
    const body = z.object({ displayName: z.string().trim().min(1).max(160), email: z.union([z.string().trim().email().max(254), z.literal("")]), subject: z.string().trim().max(120), workplace: z.string().trim().max(200) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request" });
    if (body.data.subject || body.data.workplace) {
      const [current] = await db.select({ subject: users.subject, workplace: users.workplace }).from(users).where(eq(users.id, request.authUser!.id));
      const field = await invalidTeacherCatalogField(body.data, current);
      if (field) return reply.code(400).send({ error: "invalid_catalog_selection", field });
    }
    const email = body.data.email.toLowerCase() || null;
    try {
      const [user] = await db.update(users).set({ displayName: body.data.displayName, email, subject: body.data.subject || null, workplace: body.data.workplace || null, updatedAt: new Date() }).where(eq(users.id, request.authUser!.id))
        .returning({ id: users.id, username: users.username, displayName: users.displayName, email: users.email, subject: users.subject, workplace: users.workplace });
      return { user };
    } catch (error) {
      if (uniqueConstraint(error)) return reply.code(409).send({ error: "email_exists" });
      throw error;
    }
  });

  app.post("/auth/change-password", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } }, preHandler: [authenticate, requireUser] }, async (request, reply) => {
    const body = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(10).max(200) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request" });
    const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, request.authUser!.id)).limit(1);
    if (!user || !(await verifyPassword(user.passwordHash, body.data.currentPassword))) return reply.code(400).send({ error: "invalid_current_password" });
    const passwordHash = await hashPassword(body.data.newPassword);
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, request.authUser!.id));
      await tx.delete(sessions).where(eq(sessions.userId, request.authUser!.id));
    });
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  });

  app.patch("/auth/preferences", { preHandler: [authenticate, requireUser] }, async (request, reply) => {
    const body = z.object({ language: z.enum(["vi", "en"]).optional(), theme: z.enum(["light", "dark"]).optional() }).safeParse(request.body);
    if (!body.success || Object.keys(body.data).length === 0) return reply.code(400).send({ error: "invalid_request" });
    const [user] = await db.update(users).set({ ...body.data, updatedAt: new Date() }).where(eq(users.id, request.authUser!.id))
      .returning({ id: users.id, language: users.language, theme: users.theme });
    return { user };
  });

  app.post("/auth/logout", { preHandler: [authenticate] }, async (request, reply) => {
    const rawCookie = request.cookies[SESSION_COOKIE];
    if (rawCookie) {
      const unsigned = request.unsignCookie(rawCookie);
      if (unsigned.valid && unsigned.value) {
        await db.delete(sessions).where(and(eq(sessions.tokenHash, tokenDigest(unsigned.value))));
      }
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  });
}
