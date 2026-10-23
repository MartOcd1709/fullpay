// Runs once when the Node server starts: start the in-process daily schedule (set SCHEDULER=off to disable, e.g. in CI).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SCHEDULER !== "off" && process.env.DATABASE_URL) {
    const { start } = await import("./lib/scheduler.js");
    start();
  }
}
