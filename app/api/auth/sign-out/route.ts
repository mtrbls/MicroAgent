import { COOKIE_NAME, deleteSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  await deleteSession(token)
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(COOKIE_NAME)
  return res
}

export async function GET(request: NextRequest) {
  // Convenience: hitting /api/auth/sign-out in the browser also signs out.
  const token = request.cookies.get(COOKIE_NAME)?.value
  await deleteSession(token)
  const res = NextResponse.redirect(new URL("/sign-in", request.url))
  res.cookies.delete(COOKIE_NAME)
  return res
}
