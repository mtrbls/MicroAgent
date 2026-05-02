import { sql } from "@/db"
import { getToolkitsForMate } from "@/lib/mcp"
import type { Mate } from "@/lib/types"
import { NextResponse } from "next/server"

// Use Composio REST API directly for more control
const COMPOSIO_API = "https://api.composio.dev/api/v3"

async function composioFetch(path: string, options: RequestInit = {}) {
  const response = await fetch(`${COMPOSIO_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.COMPOSIO_API_KEY!,
      ...options.headers,
    },
  })
  return response.json()
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

    // Check if Composio is configured
    if (!process.env.COMPOSIO_API_KEY) {
      return NextResponse.json({
        toolkits,
        connections: {},
        allConnected: false,
        error: "COMPOSIO_API_KEY not configured",
      })
    }

    const userId = `user_demo_${mate.id}`
    const origin = request.headers.get("origin") || "http://localhost:3000"
    const redirectUrl = `${origin}/auth/callback?mate=${id}`

    // Check connection status for each toolkit
    const connections: Record<string, { connected: boolean; authUrl?: string }> = {}
    let allConnected = true

    for (const toolkit of toolkits) {
      try {
        // Check if user has an active connection for this toolkit
        const existingConnections = await composioFetch(
          `/connectedAccounts?user_id=${encodeURIComponent(userId)}&toolkit=${toolkit}`
        )

        console.log(`[v0] Composio existing connections for ${toolkit}:`, JSON.stringify(existingConnections))

        const activeConnection = existingConnections?.items?.find(
          (c: { status: string }) => c.status === "ACTIVE"
        )

        if (activeConnection) {
          connections[toolkit] = { connected: true }
        } else {
          // Initiate a new connection to get OAuth URL
          const newConnection = await composioFetch("/connectedAccounts", {
            method: "POST",
            body: JSON.stringify({
              toolkit,
              user_id: userId,
              callback_url: redirectUrl,
            }),
          })

          console.log(`[v0] Composio new connection response for ${toolkit}:`, JSON.stringify(newConnection))

          const authUrl = newConnection?.connection?.state?.authUri || 
                         newConnection?.authUri || 
                         newConnection?.redirectUrl

          connections[toolkit] = { connected: false, authUrl }
          allConnected = false
        }
      } catch (error) {
        console.error(`[v0] Error checking ${toolkit}:`, error)
        connections[toolkit] = { connected: false }
        allConnected = false
      }
    }

    return NextResponse.json({
      toolkits,
      connections,
      allConnected,
    })
  } catch (error) {
    console.error("Error checking mate auth:", error)
    return NextResponse.json({ error: "Failed to check auth status" }, { status: 500 })
  }
}
