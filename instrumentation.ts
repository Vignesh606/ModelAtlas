/**
 * Runs once when a server instance starts: validates the environment early so
 * misconfiguration shows up in the logs at boot, not on a user's first request.
 * It warns instead of throwing, so builds without secrets (CI) still succeed.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getServerEnv } = await import("@/lib/env");
  const { env, problems } = getServerEnv();
  for (const problem of problems) console.warn(`[env] ${problem}`);
  if (!env.OPENROUTER_API_KEY) {
    console.warn("[env] OPENROUTER_API_KEY is not set: the playground will require users to bring their own key.");
  }
  if (!env.DATABASE_URL) {
    console.warn("[env] DATABASE_URL is not set: request history is disabled.");
  }
}
