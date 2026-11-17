import "./load-env.js";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { authenticate } from "./auth.js";
import { authRoutes } from "./routes/auth.js";
import { teacherRoutes } from "./routes/teachers.js";
import { quizRoutes } from "./routes/quizzes.js";
import { studentRoutes } from "./routes/student.js";
import { resultRoutes } from "./routes/results.js";
import { assetRoutes, cleanupUnusedAssets } from "./routes/assets.js";
import { quizImportRoutes } from "./routes/quiz-import.js";
import { catalogRoutes } from "./routes/catalogs.js";

const app = Fastify({ logger: true, trustProxy: true });

app.decorateRequest("authUser", null);
await app.register(cookie, { secret: process.env.SESSION_SECRET ?? "local-development-only-secret-change-before-deploy" });
await app.register(cors, { origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true });
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
app.addHook("preHandler", authenticate);

app.get("/health", async () => ({ status: "ok" }));
await app.register(authRoutes);
await app.register(teacherRoutes);
await app.register(quizRoutes);
await app.register(catalogRoutes);
await app.register(studentRoutes);
await app.register(resultRoutes);
await app.register(assetRoutes);
await app.register(quizImportRoutes);

const port = Number(process.env.API_PORT ?? 4100);
const host = process.env.API_HOST ?? "127.0.0.1";

try {
  await app.listen({ port, host });
  void cleanupUnusedAssets().catch((error) => app.log.error(error));
  setInterval(() => { void cleanupUnusedAssets().catch((error) => app.log.error(error)); }, 60 * 60 * 1000).unref();
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
