import { sql } from "@/db"
import { NextResponse } from "next/server"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const stateParam = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${error}`, request.url))
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL("/?error=missing_code", request.url))
  }

  try {
    // Decode state
    const state = JSON.parse(Buffer.from(stateParam, "base64").toString())
    const { userId } = state

    // Exchange code for tokens
    const origin = url.origin
    const redirectUri = `${origin}/api/auth/google/callback`

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    })

    const tokens = await tokenResponse.json()

    if (tokens.error) {
      console.error("Google token error:", tokens)
      return NextResponse.redirect(new URL(`/?error=${tokens.error}`, request.url))
    }

    // Calculate expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Store tokens
    const tokenId = `token_${Date.now()}`
    await sql`
      INSERT INTO oauth_tokens (id, user_id, provider, access_token, refresh_token, expires_at, scopes)
      VALUES (
        ${tokenId},
        ${userId},
        'google',
        ${tokens.access_token},
        ${tokens.refresh_token || null},
        ${expiresAt.toISOString()},
        ${tokens.scope?.split(" ") || []}
      )
      ON CONFLICT (id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, oauth_tokens.refresh_token),
        expires_at = EXCLUDED.expires_at,
        scopes = EXCLUDED.scopes
    `

    // Redirect back to app
    return NextResponse.redirect(new URL("/?connected=true", request.url))
  } catch (error) {
    console.error("OAuth callback error:", error)
    return NextResponse.redirect(new URL("/?error=callback_failed", request.url))
  }
}
