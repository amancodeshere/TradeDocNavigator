import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { db, transaction } from "../src/connect.js";

export async function migrate() {
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(20211011)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())",
    );
    const directory = new URL("../migrations/", import.meta.url);
    for (const name of (await readdir(directory))
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      const { rowCount } = await client.query(
        "SELECT name FROM schema_migrations WHERE name = $1",
        [name],
      );
      if (rowCount) continue;
      await client.query(await readFile(new URL(name, directory), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        name,
      ]);
      console.log(`Applied migration ${name}`);
    }
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await migrate();
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
