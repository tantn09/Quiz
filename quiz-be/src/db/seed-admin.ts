import "../load-env.js";
import { eq } from "drizzle-orm";
import { db, pool } from "./index.js";
import { users } from "./schema.js";
import { hashPassword } from "../password.js";

const username = process.env.ADMIN_USERNAME ?? "admin";
const password = process.env.ADMIN_INITIAL_PASSWORD ?? "Admin@1234";

try {
  const existing = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.username, username)).limit(1);
  if (existing[0]?.role === "admin") {
    console.info(`Admin account ${username} already exists; credentials were not changed.`);
  } else if (existing.length) {
    throw new Error(`User ${username} already exists with a non-admin role.`);
  } else {
    const passwordHash = await hashPassword(password);
    await db.insert(users).values({ username, displayName: "Administrator", passwordHash, role: "admin" });
    console.info(`Admin account ${username} created. Set ADMIN_INITIAL_PASSWORD explicitly outside development.`);
  }
} finally {
  await pool.end();
}
