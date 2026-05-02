import { sql } from "@/db"
import { hashPassword } from "@/lib/password"
import { sessionCookieOptions, signSession } from "@/lib/cookie"
import { NextResponse } from "next/server"

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "Server misconfigured: DATABASE_URL is not set." },
        { status: 500 }
      )
    }

    // Idempotent additive schema bootstrap.
    await sql`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY)`
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt TEXT`
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)`

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

    // Auto sign-in: set session cookie so the user lands logged in.
    const cookieValue = await signSession(id)
    const res = NextResponse.json({ ok: true, id })
    res.cookies.set({ ...sessionCookieOptions(), value: cookieValue })
    return res
  } catch (err) {
    console.error("[sign-up] failed:", err)
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Sign up failed: ${detail}` },
      { status: 500 }
    )
  }
}
