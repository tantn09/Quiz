import "../load-env.js";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index.js";

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.info("Database migrations applied.");
} finally {
  await pool.end();
}
