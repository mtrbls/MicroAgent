import { sql } from "@/db"
import { getToolkitsForMate } from "@/lib/mcp"
import type { Mate } from "@/lib/types"
import { Composio } from "@composio/core"
import { NextResponse } from "next/server"

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
})

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

    // Check if Composio is configured
    if (!process.env.COMPOSIO_API_KEY) {
      return NextResponse.json({
        toolkits,
        connections: {},
        allConnected: false,
        error: "COMPOSIO_API_KEY not configured",
      })
    }

    // Build redirect URL for after OAuth
    const origin = request.headers.get("origin") || "http://localhost:3000"
    const redirectUrl = `${origin}/auth/callback?mate=${id}`

    // Create session to check auth and get OAuth URLs
    try {
      const session = await composio.toolsets.createToolSet({
        toolkits,
        entityId: `user_demo_${mate.id}`,
        config: {
          redirectUrl,
        },
      })

      // Build connections status per toolkit
      const connections: Record<string, { connected: boolean; authUrl?: string }> = {}
      
      // If session has an auth URL, user needs to connect
      if (session.pendingAuthUrl) {
        for (const tk of toolkits) {
          connections[tk] = { connected: false, authUrl: session.pendingAuthUrl }
        }
        return NextResponse.json({
          toolkits,
          connections,
          allConnected: false,
          authUrl: session.pendingAuthUrl,
        })
      }

      // All connected
      for (const tk of toolkits) {
        connections[tk] = { connected: true }
      }
      return NextResponse.json({
        toolkits,
        connections,
        allConnected: true,
      })
    } catch (error: unknown) {
      // Composio throws when auth is needed - extract the auth URL
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Try to get auth URL from the error or create a new one
      const connections: Record<string, { connected: boolean; authUrl?: string }> = {}
      
      // Create individual auth URLs per toolkit
      for (const tk of toolkits) {
        try {
          const authUrl = await composio.getExpectedParamsForUser({
            toolkit: tk,
            entityId: `user_demo_${mate.id}`,
            redirectUrl,
          })
          connections[tk] = { connected: false, authUrl: authUrl.expectedParams?.redirectUrl || authUrl.authUrl }
        } catch {
          connections[tk] = { connected: false }
        }
      }

      return NextResponse.json({
        toolkits,
        connections,
        allConnected: false,
        error: errorMessage,
      })
    }
  } catch (error) {
    console.error("Error checking mate auth:", error)
    return NextResponse.json({ error: "Failed to check auth status" }, { status: 500 })
  }
}
