import { sql } from "@/db"
import { hashPassword } from "@/lib/password"
import { createSession, ensureSessionsTable, sessionCookieOptions } from "@/lib/session"
import { NextResponse } from "next/server"

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8

let usersBootstrapped = false

async function ensureUsersTable() {
  if (usersBootstrapped) return
  // CREATE must finish before the dependent ALTERs / INDEX run, but
  // the ALTERs and the index can fan out in parallel.
  await sql`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY)`
  await Promise.all([
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt TEXT`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)`,
  ])
  usersBootstrapped = true
}

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "Server misconfigured: DATABASE_URL is not set." },
        { status: 500 }
      )
    }

    // Bootstrap users + sessions schemas in parallel. Both are
    // module-cached so warm Lambdas skip them entirely.
    await Promise.all([ensureUsersTable(), ensureSessionsTable()])

    const body = (await request.json()) as { email?: string; password?: string }
    const email = (body.email ?? "").trim().toLowerCase()
    const password = body.password ?? ""

    if (!EMAIL_RX.test(email)) {
      return NextResponse.json({ error: "Enter a valid email." }, { status: 400 })
    }
    if (password.length < MIN_PASSWORD) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD} characters.` },
        { status: 400 }
      )
    }

    const existing = await sql`SELECT id FROM users WHERE email = ${email}`
    if (existing.length > 0) {
      return NextResponse.json({ error: "Email already in use." }, { status: 409 })
    }

    const { hash, salt } = await hashPassword(password)
    const id = `user_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`

    await sql`
      INSERT INTO users (id, email, password_hash, password_salt)
      VALUES (${id}, ${email}, ${hash}, ${salt})
    `

    // Auto sign-in: create a session row and set the cookie to its
    // opaque token. No HMAC, no shared secret.
    const token = await createSession(id)
    const res = NextResponse.json({ ok: true, id })
    res.cookies.set({ ...sessionCookieOptions(), value: token })
    return res
  } catch (err) {
    console.error("[sign-up] failed:", err)
    return NextResponse.json(
      { error: "Sign up failed. Please try again." },
      { status: 500 }
    )
  }
}
