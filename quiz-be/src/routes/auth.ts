import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authenticate, createSession, requireUser, SESSION_COOKIE, tokenDigest } from "../auth.js";
import { db } from "../db/index.js";
import { sessions, users } from "../db/schema.js";
import { verifyPassword } from "../password.js";

const loginBody = z.object({ username: z.string().trim().min(1).max(80), password: z.string().min(1).max(200) });

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/login", { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const [user] = await db.select().from(users).where(eq(users.username, parsed.data.username)).limit(1);
    if (!user || user.status !== "active" || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    await createSession(user.id, reply);
    return { user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, language: user.language, theme: user.theme } };
  });

  app.get("/auth/me", { preHandler: [authenticate, requireUser] }, async (request) => {
    const [user] = await db.select({ id: users.id, username: users.username, displayName: users.displayName, role: users.role, language: users.language, theme: users.theme })
      .from(users).where(eq(users.id, request.authUser!.id)).limit(1);
    return { user };
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
