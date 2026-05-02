import { COOKIE_NAME } from "@/lib/cookie"
import { NextResponse } from "next/server"

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(COOKIE_NAME)
  return res
}

export async function GET() {
  // Convenience: hitting /api/auth/sign-out in the browser also signs out.
  const res = NextResponse.redirect(
    new URL("/sign-in", process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000")
  )
  res.cookies.delete(COOKIE_NAME)
  return res
}
