import { sql } from "@/db"
import { getToolkitsForMate } from "@/lib/mcp"
import type { Mate } from "@/lib/types"
import { NextResponse } from "next/server"

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY
const COMPOSIO_BASE = "https://backend.composio.dev/api/v1"

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

    if (!COMPOSIO_API_KEY) {
      return NextResponse.json({
        toolkits,
        connections: {},
        allConnected: false,
        error: "COMPOSIO_API_KEY not configured",
      })
    }

    const userId = "user_demo"
    const origin = request.headers.get("origin") || "http://localhost:3000"
    const connections: Record<string, { connected: boolean; authUrl?: string }> = {}

    for (const toolkit of toolkits) {
      try {
        // Check existing connections for this user + app
        const connectionsRes = await fetch(
          `${COMPOSIO_BASE}/connectedAccounts?user_uuid=${userId}&showActiveOnly=true`,
          {
            headers: { "x-api-key": COMPOSIO_API_KEY },
          }
        )

        if (!connectionsRes.ok) {
          const errorText = await connectionsRes.text()
          console.error(`[v0] Composio connections error for ${toolkit}:`, connectionsRes.status, errorText)
          
          // Check if it's a network error (sandbox restriction)
          if (errorText.includes("ENOTFOUND") || errorText.includes("network")) {
            connections[toolkit] = { 
              connected: false, 
              authUrl: undefined,
            }
            continue
          }
          
          connections[toolkit] = { connected: false }
          continue
        }

        const connectionsData = await connectionsRes.json()
        const existingConnection = connectionsData.items?.find(
          (c: { appName: string }) => c.appName.toLowerCase() === toolkit.toLowerCase()
        )

        if (existingConnection) {
          connections[toolkit] = { connected: true }
        } else {
          // Initiate new connection
          const initiateRes = await fetch(`${COMPOSIO_BASE}/connectedAccounts`, {
            method: "POST",
            headers: {
              "x-api-key": COMPOSIO_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              integrationId: toolkit,
              userUuid: userId,
              redirectUri: `${origin}/api/auth/callback`,
            }),
          })

          if (!initiateRes.ok) {
            const errorText = await initiateRes.text()
            console.error(`[v0] Composio initiate error for ${toolkit}:`, initiateRes.status, errorText)
            connections[toolkit] = { connected: false }
            continue
          }

          const initiateData = await initiateRes.json()
          connections[toolkit] = {
            connected: false,
            authUrl: initiateData.redirectUrl || initiateData.connectionStatus?.redirectUrl,
          }
        }
      } catch (error) {
        console.error(`[v0] Error checking ${toolkit}:`, error)
        
        // Check if it's a network restriction (sandbox)
        const errorMsg = error instanceof Error ? error.message : String(error)
        if (errorMsg.includes("ENOTFOUND") || errorMsg.includes("getaddrinfo")) {
          return NextResponse.json({
            toolkits,
            connections: {},
            allConnected: false,
            error: "Cannot reach Composio from v0 preview. Deploy to Vercel to enable OAuth.",
            sandboxRestriction: true,
          })
        }
        
        connections[toolkit] = { connected: false }
      }
    }

    const allConnected = Object.values(connections).every((c) => c.connected)

    return NextResponse.json({
      toolkits,
      connections,
      allConnected,
    })
  } catch (error) {
    console.error("[v0] Auth route error:", error)
    
    const errorMsg = error instanceof Error ? error.message : String(error)
    if (errorMsg.includes("ENOTFOUND") || errorMsg.includes("getaddrinfo")) {
      return NextResponse.json({
        error: "Cannot reach Composio from v0 preview. Deploy to Vercel to enable OAuth.",
        sandboxRestriction: true,
      })
    }
    
    return NextResponse.json({ error: "Failed to check auth status" }, { status: 500 })
  }
}
