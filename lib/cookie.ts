// HMAC-signed session cookies. Edge-compatible (uses Web Crypto only).

export const COOKIE_NAME = "uagent_session"
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

interface SessionPayload {
  userId: string
  /** Absolute expiry, ms since epoch. */
  exp: number
}

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_COOKIE_SECRET
  if (!raw || raw.length < 16) {
    // Fallback only — in production, set AUTH_COOKIE_SECRET to a random
    // 32+ char string. Cookies signed under the fallback aren't portable
    // across deployments.
    return new TextEncoder().encode("dev-only-not-for-prod-secret-x9k2")
  }
  return new TextEncoder().encode(raw)
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let str = ""
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4)
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad)
  const str = atob(b64)
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i)
  return bytes
}

async function hmac(payloadBytes: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    getSecret(),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, payloadBytes)
  return new Uint8Array(sig)
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function signSession(userId: string): Promise<string> {
  const payload: SessionPayload = { userId, exp: Date.now() + SESSION_TTL_MS }
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload))
  const sig = await hmac(payloadBytes)
  return `${bytesToBase64Url(payloadBytes)}.${bytesToBase64Url(sig)}`
}

export async function verifySession(cookieValue: string | undefined): Promise<string | null> {
  if (!cookieValue) return null
  const dot = cookieValue.indexOf(".")
  if (dot < 0) return null
  const payloadPart = cookieValue.slice(0, dot)
  const sigPart = cookieValue.slice(dot + 1)
  let payloadBytes: Uint8Array
  let providedSig: Uint8Array
  try {
    payloadBytes = base64UrlToBytes(payloadPart)
    providedSig = base64UrlToBytes(sigPart)
  } catch {
    return null
  }
  const expectedSig = await hmac(payloadBytes)
  if (!timingSafeEqual(expectedSig, providedSig)) return null
  try {
    const parsed = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload
    if (typeof parsed.userId !== "string" || typeof parsed.exp !== "number") return null
    if (Date.now() > parsed.exp) return null
    return parsed.userId
  } catch {
    return null
  }
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
