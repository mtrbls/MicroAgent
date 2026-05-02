import { sql } from "@/db"
import { verifyPassword } from "@/lib/password"
import { sessionCookieOptions, signSession } from "@/lib/cookie"
import { NextResponse } from "next/server"

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

    if (rows.length === 0) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
    }
    const row = rows[0]
    if (!row.password_hash || !row.password_salt) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
    }
    const ok = await verifyPassword(password, row.password_hash, row.password_salt)
    if (!ok) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
    }

    const cookieValue = await signSession(row.id)
    const res = NextResponse.json({ ok: true })
    res.cookies.set({ ...sessionCookieOptions(), value: cookieValue })
    return res
  } catch (err) {
    console.error("[sign-in] failed:", err)
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Sign in failed: ${detail}` }, { status: 500 })
  }
}
