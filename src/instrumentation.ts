export async function register() {
  // Only run the cron scheduler on the Node.js server runtime (not Edge, not build)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCronScheduler } = await import("./lib/cron-scheduler");
    startCronScheduler();
  }
}
