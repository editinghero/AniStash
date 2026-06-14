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

export async function validateSession(db: any, request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get("Cookie");
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies["anistash_session"];
  if (!sessionId) return null;

  try {
    const session = await db
      .prepare("SELECT user_id, expires_at FROM sessions WHERE id = ?")
      .bind(sessionId)
      .first();

    if (!session) return null;

    if (session.expires_at < Date.now()) {
      await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
      return null;
    }

    return session.user_id as string;
  } catch (err) {
    return null;
  }
}

export async function createSession(db: any, userId: string): Promise<{ token: string; expiresAt: number }> {
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  
  await db
    .prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(token, userId, expiresAt, Date.now())
    .run();
    
  return { token, expiresAt };
}

export async function destroySession(db: any, request: Request): Promise<void> {
  const cookieHeader = request.headers.get("Cookie");
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies["anistash_session"];
  if (!sessionId) return;

  try {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  } catch {
  }
}

export async function isSignupAllowed(allowedEnv?: string): Promise<boolean> {
  if (allowedEnv !== undefined && allowedEnv !== null && allowedEnv.toLowerCase() === "false") {
    return false;
  }
  return true;
}
