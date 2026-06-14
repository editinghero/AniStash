export async function getDB() {
  if (typeof window !== "undefined") {
    throw new Error("getDB() cannot be called on the client");
  }

  // If DB binding is directly available in process.env (e.g. mocked or local sqlite proxy)
  if (typeof process !== "undefined" && process.env && (process.env as any).DB) {
    return (process.env as any).DB as D1Database;
  }

  try {
    const httpMod = "vinxi/http";
    const { getEvent } = await import(/* @vite-ignore */ httpMod);
    const event = getEvent();
    if (event) {
      const cloudflareEnv = (event.context as any).cloudflare?.env;
      const db = cloudflareEnv?.DB ?? process.env.DB;
      if (db) return db as D1Database;
    }
  } catch (err) {
    console.warn("Could not retrieve D1 database binding from Vinxi event context:", err);
  }

  // Fallback: if we are in local dev, let's see if we can use a mock or throw a helpful error
  throw new Error("D1 database binding 'DB' not found in environment bindings. Make sure you are running wrangler or binding is configured.");
}

export async function getEnvVar(name: string): Promise<string | undefined> {
  if (typeof window !== "undefined") {
    return undefined;
  }

  // Priority 1: Check process.env (Node.js / Vite dev server with .env files)
  if (typeof process !== "undefined" && process.env && process.env[name] !== undefined) {
    return process.env[name];
  }

  // Priority 2: Cloudflare Workers/Pages bindings via Vinxi/h3 context
  try {
    const httpMod = "vinxi/http";
    const { getEvent } = await import(/* @vite-ignore */ httpMod);
    const event = getEvent();
    if (event) {
      // Try cloudflare.env first (Workers/Pages production)
      const cloudflareEnv = (event.context as any).cloudflare?.env;
      if (cloudflareEnv && cloudflareEnv[name] !== undefined) {
        return cloudflareEnv[name];
      }
      
      // Fallback to context.env
      const contextEnv = (event.context as any).env;
      if (contextEnv && contextEnv[name] !== undefined) {
        return contextEnv[name];
      }
    }
  } catch (err) {
    // Silent catch, will try other methods
  }

  // Priority 3: Direct process.env access (some runtimes)
  if (typeof process !== "undefined" && process.env) {
    return process.env[name];
  }

  return undefined;
}
