import { sql } from "@/db"
import { getToolkitsForMate } from "@/lib/mcp"
import type { Mate } from "@/lib/types"
import { NextResponse } from "next/server"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

// Map toolkit names to Google OAuth scopes
const TOOLKIT_SCOPES: Record<string, string[]> = {
  gmail: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.modify",
  ],
  googlecalendar: [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
  ],
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Load mate
    const mates = await sql`SELECT * FROM mates WHERE id = ${id}`
    if (mates.length === 0) {
      return NextResponse.json({ error: "Mate not found" }, { status: 404 })
    }
    const mate = mates[0] as unknown as Mate

    // Check what toolkits are needed
    const toolkits = getToolkitsForMate(mate)

    if (toolkits.length === 0) {
      return NextResponse.json({
        toolkits: [],
        connections: {},
        allConnected: true,
      })
    }

    // Check if Google OAuth is configured
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      const connections: Record<string, { connected: boolean; needsSetup: boolean }> = {}
      for (const toolkit of toolkits) {
        connections[toolkit] = { connected: false, needsSetup: true }
      }
      return NextResponse.json({
        toolkits,
        connections,
        allConnected: false,
        error: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable OAuth",
      })
    }

    // Check for existing valid token
    const tokens = await sql`
      SELECT * FROM oauth_tokens 
      WHERE user_id = 'user_demo' 
      AND provider = 'google'
      AND expires_at > NOW()
    `
    const hasValidToken = tokens.length > 0

    // Build OAuth URL if needed
    const origin = request.headers.get("origin") || "http://localhost:3000"
    const redirectUri = `${origin}/api/auth/google/callback`
    
    // Collect all required scopes
    const allScopes = ["openid", "email", "profile"]
    for (const toolkit of toolkits) {
      allScopes.push(...(TOOLKIT_SCOPES[toolkit] || []))
    }
    
    const state = Buffer.from(JSON.stringify({ mateId: id, userId: "user_demo" })).toString("base64")
    const authUrl = hasValidToken ? undefined : buildGoogleAuthUrl([...new Set(allScopes)], redirectUri, state)

    // Build connections response
    const connections: Record<string, { connected: boolean; authUrl?: string }> = {}
    for (const toolkit of toolkits) {
      connections[toolkit] = {
        connected: hasValidToken,
        authUrl,
      }
    }

    return NextResponse.json({
      toolkits,
      connections,
      allConnected: hasValidToken,
    })
  } catch (error) {
    console.error("Error checking mate auth:", error)
    return NextResponse.json({ error: "Failed to check auth status" }, { status: 500 })
  }
}

function buildGoogleAuthUrl(scopes: string[], redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}
