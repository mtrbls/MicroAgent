import { NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { verifyPassword } from "@/lib/password"

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$).*)"],
}

const PUBLIC_PATHS = new Set(["/sign-up", "/api/auth/sign-up"])

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next()
  }

  if (!process.env.DATABASE_URL) {
    return new NextResponse("Server misconfigured: DATABASE_URL missing", { status: 500 })
  }

  const header = req.headers.get("authorization")
  if (header?.startsWith("Basic ")) {
    const encoded = header.slice("Basic ".length)
    const decoded = decodeBase64(encoded)
    const idx = decoded.indexOf(":")
    if (idx >= 0) {
      const email = decoded.slice(0, idx).trim().toLowerCase()
      const password = decoded.slice(idx + 1)
      try {
        const sql = neon(process.env.DATABASE_URL)
        const rows = (await sql`
          SELECT id, password_hash, password_salt
          FROM users
          WHERE email = ${email}
          LIMIT 1
        `) as Array<{ id: string; password_hash: string; password_salt: string }>
        if (rows.length === 1) {
          const ok = await verifyPassword(password, rows[0].password_hash, rows[0].password_salt)
          if (ok) {
            const fwd = new Headers(req.headers)
            fwd.set("x-user-id", rows[0].id)
            return NextResponse.next({ request: { headers: fwd } })
          }
        }
      } catch (err) {
        // Likely the users table doesn't exist yet — fall through to 401.
        console.error("[auth] middleware lookup failed:", err)
      }
    }
  }

  return new NextResponse(SIGN_IN_HTML, {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="μAgent", charset="UTF-8"',
      "Content-Type": "text/html; charset=utf-8",
    },
  })
}

function decodeBase64(input: string): string {
  try {
    return atob(input)
  } catch {
    return Buffer.from(input, "base64").toString("utf-8")
  }
}

const SIGN_IN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>μAgent — Sign in</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 420px; margin: 96px auto; padding: 0 16px; color: #1a1a1a; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: -0.02em; }
    p  { font-size: 14px; line-height: 1.5; color: #444; }
    a.btn { display: inline-block; margin-top: 16px; padding: 10px 16px; border: 2px solid #1a1a1a; text-decoration: none; color: #1a1a1a; box-shadow: 4px 4px 0 0 #1a1a1a; }
  </style>
</head>
<body>
  <h1>μAgent</h1>
  <p>Sign in with your email + password — your browser should pop a dialog. If you cancelled it, refresh the page to try again.</p>
  <p>New here? <a class="btn" href="/sign-up">Create an account →</a></p>
</body>
</html>`
