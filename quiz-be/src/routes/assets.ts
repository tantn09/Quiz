import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { eq, lt } from "drizzle-orm";
import { z } from "zod";
import { requireTeacherAccess } from "../auth.js";
import { db } from "../db/index.js";
import { quizAssets, quizzes, submissions } from "../db/schema.js";

const assetDir = process.env.ASSET_DIR ?? "./uploads";
const uploadBody = z.object({ data: z.string().max(7_000_000) });
const formats = [
  { mime: "image/png", ext: "png", matches: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
  { mime: "image/jpeg", ext: "jpg", matches: (b: Buffer) => b[0] === 255 && b[1] === 216 && b[2] === 255 },
  { mime: "image/webp", ext: "webp", matches: (b: Buffer) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
];

export async function assetRoutes(app: FastifyInstance): Promise<void> {
  app.post("/teacher/assets", { preHandler: [requireTeacherAccess], bodyLimit: 7_000_000 }, async (request, reply) => {
    const parsed = uploadBody.safeParse(request.body);
    if (!parsed.success || !/^[A-Za-z0-9+/]+={0,2}$/.test(parsed.data.data)) return reply.code(400).send({ error: "invalid_image" });
    const buffer = Buffer.from(parsed.data.data, "base64");
    if (buffer.length < 12 || buffer.length > 5_000_000) return reply.code(400).send({ error: "invalid_image_size" });
    const format = formats.find((item) => item.matches(buffer));
    if (!format) return reply.code(400).send({ error: "invalid_image_type" });
    const id = randomUUID();
    await mkdir(assetDir, { recursive: true });
    const path = join(assetDir, `${id}.${format.ext}`);
    await writeFile(path, buffer, { flag: "wx" });
    try { await db.insert(quizAssets).values({ id, uploadedBy: request.authUser!.id, mimeType: format.mime, size: buffer.length }); }
    catch (error) { await unlink(path); throw error; }
    return reply.code(201).send({ id, url: `/api/public/assets/${id}` });
  });

  app.get("/public/assets/:id", async (request, reply) => {
    const parsed = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!parsed.success) return reply.code(404).send({ error: "not_found" });
    const [asset] = await db.select().from(quizAssets).where(eq(quizAssets.id, parsed.data.id)).limit(1);
    if (!asset) return reply.code(404).send({ error: "not_found" });
    const ext = formats.find((item) => item.mime === asset.mimeType)!.ext;
    try { return reply.type(asset.mimeType).header("Cache-Control", "public, max-age=31536000, immutable").header("X-Content-Type-Options", "nosniff").send(await readFile(join(assetDir, `${asset.id}.${ext}`))); }
    catch { return reply.code(404).send({ error: "not_found" }); }
  });
}

export async function cleanupUnusedAssets(): Promise<void> {
  const old = await db.select().from(quizAssets).where(lt(quizAssets.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
  if (!old.length) return;
  const quizImages = await db.select({ images: quizzes.promptImages }).from(quizzes);
  const attemptImages = await db.select({ prompt: submissions.promptSnapshot }).from(submissions);
  const used = new Set([...quizImages.flatMap((row) => row.images.map((image) => image.id)), ...attemptImages.flatMap((row) => row.prompt?.images.map((image) => image.id) ?? [])]);
  for (const asset of old) {
    if (used.has(asset.id)) continue;
    const ext = formats.find((item) => item.mime === asset.mimeType)?.ext;
    if (!ext) continue;
    await unlink(join(assetDir, `${asset.id}.${ext}`)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
    await db.delete(quizAssets).where(eq(quizAssets.id, asset.id));
  }
}
