import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { parseCookies, createSession, destroySession, validateSession, isSignupAllowed } from '../../src/lib/auth';
import { hashPassword, verifyPassword } from '../../src/lib/crypto';

type Bindings = {
  DB: D1Database;
  ALLOW_SIGNUP?: string;
};

function checkIsDev(c: any): boolean {
  const host = c.req.header('host') || '';
  return (
    host.includes('localhost') ||
    host.includes('127.0.0.1') ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development')
  );
}

export const authRouter = new Hono<{ Bindings: Bindings }>()
  .get('/status', async (c) => {
    try {
      const allowed = await isSignupAllowed(c.env.ALLOW_SIGNUP);
      return c.json({ allowed });
    } catch (e) {
      return c.json({ allowed: true });
    }
  })
  .post('/signup', zValidator('json', z.object({
    displayName: z.string().min(2).max(50),
    email: z.string().email(),
    password: z.string().min(6),
  })), async (c) => {
    const data = c.req.valid('json');
    const allowed = await isSignupAllowed(c.env.ALLOW_SIGNUP);
    
    if (!allowed) {
      return c.json({ error: "Signups are currently disabled." }, 403);
    }

    const db = c.env.DB;
    const existing = await db
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(data.email.toLowerCase().trim())
      .first();

    if (existing) {
      return c.json({ error: "An account with this email already exists." }, 409);
    }

    const userId = crypto.randomUUID();
    const passHash = await hashPassword(data.password);
    const now = Date.now();

    await db
      .prepare("INSERT INTO users (id, email, email_verified, display_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(userId, data.email.toLowerCase().trim(), 1, data.displayName.trim(), passHash, now, now)
      .run();

    await db
      .prepare("INSERT INTO user_settings (user_id, gemini_model, theme, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .bind(userId, "gemini-2.5-flash", "dark", now, now)
      .run();

    const { token, expiresAt } = await createSession(db, userId);

    const isDev = checkIsDev(c);
    c.header('Set-Cookie', `anistash_session=${token}; Path=/; HttpOnly; SameSite=Lax${isDev ? "" : "; Secure"}; Expires=${new Date(expiresAt).toUTCString()}`);

    return c.json({ success: true });
  })
  .post('/login', zValidator('json', z.object({
    email: z.string().email(),
    password: z.string(),
  })), async (c) => {
    const data = c.req.valid('json');
    const db = c.env.DB;
    
    const user = await db
      .prepare("SELECT id, password_hash as passwordHash FROM users WHERE email = ?")
      .bind(data.email.toLowerCase().trim())
      .first<{ id: string; passwordHash: string }>();

    if (!user) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const valid = await verifyPassword(data.password, user.passwordHash);
    if (!valid) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const { token, expiresAt } = await createSession(db, user.id);
    const isDev = checkIsDev(c);
    c.header('Set-Cookie', `anistash_session=${token}; Path=/; HttpOnly; SameSite=Lax${isDev ? "" : "; Secure"}; Expires=${new Date(expiresAt).toUTCString()}`);

    return c.json({ success: true });
  })
  .post('/logout', async (c) => {
    await destroySession(c.env.DB, c.req.raw);
    const isDev = checkIsDev(c);
    c.header('Set-Cookie', `anistash_session=; Path=/; HttpOnly; SameSite=Lax${isDev ? "" : "; Secure"}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
    return c.json({ success: true });
  })
  .get('/me', async (c) => {
    const userId = await validateSession(c.env.DB, c.req.raw);
    if (!userId) return c.json(null);
    
    const user = await c.env.DB
      .prepare("SELECT id, email, display_name as displayName, avatar_url as avatarUrl FROM users WHERE id = ?")
      .bind(userId)
      .first<{ id: string; email: string; displayName: string | null; avatarUrl: string | null }>();
      
    return c.json(user);
  });
