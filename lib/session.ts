// Server-side opaque session tokens, stored in Postgres.
// The cookie value is a 256-bit random token — no signing or shared
// secret needed. To forge a session you'd have to guess the token
// (~impossible) or write to the sessions table (DB access required,
// which is already game over for the rest of the data).

import { sql } from "@/db"

export const COOKIE_NAME = "uagent_session"
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export async function createSession(userId: string): Promise<string> {
  const token = randomToken()
  const expires = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  await sql`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${userId}, ${expires})
  `
  return token
}

export async function lookupSession(token: string | undefined | null): Promise<string | null> {
  if (!token) return null
  try {
    const rows = (await sql`
      SELECT user_id FROM sessions
      WHERE token = ${token} AND expires_at > NOW()
      LIMIT 1
    `) as Array<{ user_id: string }>
    return rows[0]?.user_id ?? null
  } catch {
    // Table may not exist yet on a fresh deploy — treat as unauth.
    return null
  }
}

export async function deleteSession(token: string | undefined | null): Promise<void> {
  if (!token) return
  try {
    await sql`DELETE FROM sessions WHERE token = ${token}`
  } catch {
    // ignore — best-effort
  }
}

/** Idempotent — safe to call from any route on first hit. */
export async function ensureSessionsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id)`
  await sql`CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at)`
}

export function sessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  }
}
