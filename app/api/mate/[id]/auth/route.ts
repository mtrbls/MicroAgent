import { sql } from "@/db"
import { checkAuthStatus, getToolkitsForMate } from "@/lib/mcp"
import type { Mate } from "@/lib/types"
import { NextResponse } from "next/server"

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

    if (!process.env.COMPOSIO_API_KEY) {
      return NextResponse.json({
        toolkits,
        connections: {},
        allConnected: false,
        error: "COMPOSIO_API_KEY not configured",
      })
    }

    const userId = "user_demo"
    const result = await checkAuthStatus(mate, userId)

    if ("error" in result && result.error) {
      // Check for network errors (sandbox restriction)
      if (result.error.includes("ENOTFOUND") || result.error.includes("getaddrinfo")) {
        return NextResponse.json({
          toolkits,
          connections: {},
          allConnected: false,
          error: "Cannot reach Composio from v0 preview. Deploy to Vercel to enable OAuth.",
          sandboxRestriction: true,
        })
      }

      return NextResponse.json({
        toolkits,
        connections: {},
        allConnected: false,
        error: result.error,
      })
    }

    const connections = result.connections || {}
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
