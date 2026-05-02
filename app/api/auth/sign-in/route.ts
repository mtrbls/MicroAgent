import { sql } from "@/db"
import { verifyPassword } from "@/lib/password"
import { createSession, ensureSessionsTable, sessionCookieOptions } from "@/lib/session"
import { NextResponse } from "next/server"

// Pre-computed bogus hash + salt of the same shape as a real one
// (PBKDF2-SHA256 256-bit hex / 16-byte salt hex). Used to keep the
// no-such-email branch the same cost as a real verify.
const DUMMY_HASH = "0".repeat(64)
const DUMMY_SALT = "0".repeat(32)

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "Server misconfigured: DATABASE_URL is not set." },
        { status: 500 }
      )
    }

    const body = (await request.json()) as { email?: string; password?: string }
    const email = (body.email ?? "").trim().toLowerCase()
    const password = body.password ?? ""
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required." }, { status: 400 })
    }

    const rows = (await sql`
      SELECT id, password_hash, password_salt
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `) as Array<{ id: string; password_hash: string | null; password_salt: string | null }>

    // Always run a verifyPassword so the response time is constant whether
    // or not the email exists — kills the trivial account-enumeration
    // timing oracle.
    const candidateHash = rows[0]?.password_hash ?? DUMMY_HASH
    const candidateSalt = rows[0]?.password_salt ?? DUMMY_SALT
    const ok = await verifyPassword(password, candidateHash, candidateSalt)

    if (rows.length === 0 || !rows[0].password_hash || !rows[0].password_salt || !ok) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
    }
    const row = rows[0]

    await ensureSessionsTable()
    const token = await createSession(row.id)
    const res = NextResponse.json({ ok: true })
    res.cookies.set({ ...sessionCookieOptions(), value: token })
    return res
  } catch (err) {
    console.error("[sign-in] failed:", err)
    return NextResponse.json({ error: "Sign in failed. Please try again." }, { status: 500 })
  }
}
