import { getDB, getEnvVar } from "./db";
import { createServerFn } from "@tanstack/react-start";

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx > 0) {
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  }
  return cookies;
}

export async function validateSession(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get("Cookie");
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies["anistash_session"];
  if (!sessionId) return null;

  try {
    const db = await getDB();
    const session = await db
      .prepare("SELECT user_id, expires_at FROM sessions WHERE id = ?")
      .bind(sessionId)
      .first<{ user_id: string; expires_at: number }>();

    if (!session) return null;

    if (session.expires_at < Date.now()) {
      await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
      return null;
    }

    return session.user_id;
  } catch (err) {
    // DB not available (e.g. running vite dev without wrangler) — treat as not logged in
    console.warn("validateSession: DB unavailable, treating as unauthenticated", err);
    return null;
  }
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: number }> {
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const db = await getDB();
  
  await db
    .prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(token, userId, expiresAt, Date.now())
    .run();
    
  return { token, expiresAt };
}

export async function destroySession(request: Request): Promise<void> {
  const cookieHeader = request.headers.get("Cookie");
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies["anistash_session"];
  if (!sessionId) return;

  try {
    const db = await getDB();
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  } catch {
    // DB not available, nothing to destroy
  }
}

export async function isSignupAllowed(): Promise<boolean> {
  const allowed = await getEnvVar("ALLOW_SIGNUP");
  
  // Log for debugging (only in development)
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
    console.log("[isSignupAllowed] ALLOW_SIGNUP env var:", allowed);
  }
  
  // If explicitly set to "false" (case-insensitive), disable signups
  if (allowed !== undefined && allowed !== null && allowed.toLowerCase() === "false") {
    return false;
  }
  
  // Default: allow signups (true for backwards compatibility)
  return true;
}

export const getCurrentUser = createServerFn({ method: "GET" })
  .handler(async ({ request }) => {
    try {
      const userId = await validateSession(request);
      if (!userId) return null;
      
      const db = await getDB();
      const user = await db
        .prepare("SELECT id, email, display_name as displayName, avatar_url as avatarUrl FROM users WHERE id = ?")
        .bind(userId)
        .first<{ id: string; email: string; displayName: string | null; avatarUrl: string | null }>();
        
      return user;
    } catch (err) {
      // DB not available — treat as not logged in
      console.warn("getCurrentUser: DB unavailable", err);
      return null;
    }
  });

export const logoutUser = createServerFn({ method: "POST" })
  .handler(async ({ request }) => {
    await destroySession(request);
    
    const httpMod = "vinxi/http";
    const { setResponseHeader } = await import(/* @vite-ignore */ httpMod);
    const isDev = process.env.NODE_ENV === "development";
    setResponseHeader(
      "Set-Cookie",
      `anistash_session=; Path=/; HttpOnly; SameSite=Lax${isDev ? "" : "; Secure"}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    );
    
    return { success: true };
  });
