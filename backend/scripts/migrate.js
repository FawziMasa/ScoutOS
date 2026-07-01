import "../config/env.js";
import db from "../database/db.js";
import { ensureCoreSchema } from "../database/schema.js";

try {
  await ensureCoreSchema();

  const [tables] = await db.execute(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      ORDER BY table_name
    `,
  );

  console.log("ScoutOS database is ready.");
  console.table(tables);
} catch (error) {
  console.error("ScoutOS database migration failed.");
  console.error(error);
  process.exitCode = 1;
} finally {
  await db.end();
}
