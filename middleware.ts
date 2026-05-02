import { NextRequest, NextResponse } from "next/server"
import { COOKIE_NAME, verifySession } from "@/lib/cookie"

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$).*)"],
}

const PUBLIC_PATHS = new Set([
  "/sign-up",
  "/sign-in",
  "/api/auth/sign-up",
  "/api/auth/sign-in",
  "/api/auth/sign-out",
])

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next()
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value
  const userId = await verifySession(cookie)

  if (userId) {
    const fwd = new Headers(req.headers)
    fwd.set("x-user-id", userId)
    return NextResponse.next({ request: { headers: fwd } })
  }

  // Unauthenticated. For pages, redirect to /sign-in. For API calls,
  // return a JSON 401 — the client can handle it.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  }
  const url = req.nextUrl.clone()
  url.pathname = "/sign-in"
  url.searchParams.set("next", pathname)
  return NextResponse.redirect(url)
}
