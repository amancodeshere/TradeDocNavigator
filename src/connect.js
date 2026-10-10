import "dotenv/config";
import pg from "pg";

const ssl =
  process.env.DATABASE_SSL === "true"
    ? {
        rejectUnauthorized: true,
        ...(process.env.DATABASE_CA ? { ca: process.env.DATABASE_CA } : {}),
      }
    : undefined;

export const db = new pg.Pool({
  ...(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || process.env.PGHOST || "127.0.0.1",
        port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
        user: process.env.DB_USER || process.env.PGUSER,
        password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
        database: process.env.DB_NAME || process.env.PGDATABASE || "tradedocs",
      }),
  ssl,
  max: 10,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
});
db.on("error", (error) => console.error("Database pool error:", error.message));

export async function transaction(work) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
