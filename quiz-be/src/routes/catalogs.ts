import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin, requireTeacherAccess } from "../auth.js";
import { db } from "../db/index.js";
import { gradeLevels, subjects, workplaces } from "../db/schema.js";

export const catalogKey = (name: string) => name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
const nameBody = z.object({ name: z.string().trim().min(1).max(120) });
const idParams = z.object({ id: z.string().uuid() });
const normalizedName = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();

async function teacherCatalogs() {
  const [subjectOptions, workplaceOptions] = await Promise.all([
    db.select({ id: subjects.id, name: subjects.name }).from(subjects).orderBy(subjects.name),
    db.select({ id: workplaces.id, name: workplaces.name }).from(workplaces).orderBy(workplaces.name),
  ]);
  return { subjects: subjectOptions, workplaces: workplaceOptions };
}

type TeacherLabels = { subject?: string | null; workplace?: string | null };

export async function invalidTeacherCatalogField(labels: TeacherLabels, current: TeacherLabels = {}) {
  for (const [field, table] of [["subject", subjects], ["workplace", workplaces]] as const) {
    const name = labels[field];
    if (!name || name === current[field]) continue;
    const [item] = await db.select({ id: table.id }).from(table).where(eq(table.name, name)).limit(1);
    if (!item) return field;
  }
}

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  app.get("/public/teacher-catalogs", teacherCatalogs);
  app.get("/teacher/catalogs", { preHandler: [requireTeacherAccess] }, async () => ({
    ...(await teacherCatalogs()),
    gradeLevels: await db.select({ id: gradeLevels.id, name: gradeLevels.name }).from(gradeLevels).orderBy(gradeLevels.name),
  }));
  for (const [path, table] of [["subjects", subjects], ["grade-levels", gradeLevels], ["workplaces", workplaces]] as const) {
    app.post(`/admin/catalogs/${path}`, { preHandler: [requireAdmin] }, async (request, reply) => {
      const body = nameBody.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "invalid_request" });
      const name = normalizedName(body.data.name);
      if (!name || name.length > 120) return reply.code(400).send({ error: "invalid_request" });
      try {
        const [item] = await db.insert(table).values({ name, nameKey: catalogKey(name) }).returning();
        return reply.code(201).send({ item });
      } catch (error) {
        if ((error as { code?: string }).code === "23505") return reply.code(409).send({ error: "duplicate_name" });
        throw error;
      }
    });
    app.put(`/admin/catalogs/${path}/:id`, { preHandler: [requireAdmin] }, async (request, reply) => {
      const params = idParams.safeParse(request.params);
      const body = nameBody.safeParse(request.body);
      if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
      const name = normalizedName(body.data.name);
      if (!name || name.length > 120) return reply.code(400).send({ error: "invalid_request" });
      try {
        const [item] = await db.update(table).set({ name, nameKey: catalogKey(name) }).where(eq(table.id, params.data.id)).returning();
        if (!item) return reply.code(404).send({ error: "not_found" });
        return { item };
      } catch (error) {
        if ((error as { code?: string }).code === "23505") return reply.code(409).send({ error: "duplicate_name" });
        throw error;
      }
    });
    app.delete(`/admin/catalogs/${path}/:id`, { preHandler: [requireAdmin] }, async (request, reply) => {
      const params = idParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: "invalid_request" });
      const [item] = await db.delete(table).where(eq(table.id, params.data.id)).returning({ id: table.id });
      if (!item) return reply.code(404).send({ error: "not_found" });
      return reply.code(204).send();
    });
  }
}
