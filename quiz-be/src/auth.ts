import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { and, eq, gt } from "drizzle-orm";
import { db } from "./db/index.js";
import { sessions, users } from "./db/schema.js";

export type AuthUser = Pick<typeof users.$inferSelect, "id" | "username" | "displayName" | "role" | "language">;

declare module "fastify" {
  interface FastifyRequest { authUser: AuthUser | null }
}

export const SESSION_COOKIE = "quiz_session";
const cookieSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === "production" && (!cookieSecret || cookieSecret.length < 32)) {
  throw new Error("SESSION_SECRET must contain at least 32 characters in production");
}

export function tokenDigest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, reply: FastifyReply): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  await db.insert(sessions).values({ userId, tokenHash: tokenDigest(token), expiresAt });
  reply.setCookie(SESSION_COOKIE, token, {
    signed: true,
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true" || (process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production"),
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

export async function authenticate(request: FastifyRequest): Promise<void> {
  request.authUser = null;
  const rawCookie = request.cookies[SESSION_COOKIE];
  if (!rawCookie) return;
  const unsigned = request.unsignCookie(rawCookie);
  if (!unsigned.valid || !unsigned.value) return;
  const session = await db.select({ user: users }).from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenDigest(unsigned.value)), gt(sessions.expiresAt, new Date()), eq(users.status, "active")))
    .limit(1);
  if (session[0]) {
    const { id, username, displayName, role, language } = session[0].user;
    request.authUser = { id, username, displayName, role, language };
  }
}

export async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.authUser) await reply.code(401).send({ error: "unauthorized" });
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.authUser) return void await reply.code(401).send({ error: "unauthorized" });
  if (request.authUser.role !== "admin") await reply.code(403).send({ error: "forbidden" });
}

export async function requireTeacherAccess(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.authUser) return void await reply.code(401).send({ error: "unauthorized" });
  if (request.authUser.role !== "admin" && request.authUser.role !== "teacher") {
    await reply.code(403).send({ error: "forbidden" });
  }
}
