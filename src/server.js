import { app } from "./app.js";
import { db } from "./connect.js";
import { migrate } from "../scripts/migrate.js";

try {
  await migrate();
  const server = app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
    console.log("TradeDocs Navigator is ready."),
  );
  const shutdown = () => {
    const timeout = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
      await db.end();
      clearTimeout(timeout);
      process.exit(0);
    });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
} catch (error) {
  console.error(
    "Startup failed. Check DATABASE_URL and PostgreSQL availability:",
    error.message,
  );
  await db.end();
  process.exitCode = 1;
}
