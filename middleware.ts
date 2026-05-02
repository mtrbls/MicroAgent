import { NextRequest, NextResponse } from "next/server"

export const config = {
  // Match every route except Next.js internal assets and the icon files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$).*)"],
}

export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER
  const pass = process.env.BASIC_AUTH_PASS

  // If creds aren't configured, the gate is open. Useful in dev — the
  // moment you set both env vars (locally or on Vercel) the app is locked.
  if (!user || !pass) return NextResponse.next()

  const header = req.headers.get("authorization")
  if (header?.startsWith("Basic ")) {
    const encoded = header.slice("Basic ".length)
    const decoded = decodeBase64(encoded)
    const idx = decoded.indexOf(":")
    if (idx >= 0) {
      const u = decoded.slice(0, idx)
      const p = decoded.slice(idx + 1)
      if (u === user && p === pass) return NextResponse.next()
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="μAgent", charset="UTF-8"',
      "Content-Type": "text/plain",
    },
  })
}

function decodeBase64(input: string): string {
  // Edge runtime ships atob; fall back to manual decode if absent.
  try {
    return atob(input)
  } catch {
    return Buffer.from(input, "base64").toString("utf-8")
  }
}
