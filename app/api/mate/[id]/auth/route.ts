import { sql } from "@/db"
import { getUserId } from "@/lib/auth"
import { checkAuthStatus, getToolkitsForMate } from "@/lib/mcp"
import type { Mate } from "@/lib/types"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId()
    const { id } = await params

    const mates = await sql`
      SELECT * FROM mates WHERE id = ${id} AND user_id = ${userId}
    `
    if (mates.length === 0) {
      return NextResponse.json({ error: "Mate not found" }, { status: 404 })
    }
    const mate = mates[0] as unknown as Mate

    const toolkits = getToolkitsForMate(mate)
    if (toolkits.length === 0) {
      return NextResponse.json({ toolkits: [], connections: {}, allConnected: true })
    }

    if (!process.env.COMPOSIO_API_KEY) {
      return NextResponse.json(
        {
          toolkits,
          connections: {},
          allConnected: false,
          error: "COMPOSIO_API_KEY not configured",
        },
        { status: 500 }
      )
    }

    const result = await checkAuthStatus(mate, userId)

    if ("error" in result && result.error) {
      return NextResponse.json(
        { toolkits, connections: {}, allConnected: false, error: result.error },
        { status: 502 }
      )
    }

    const connections = result.connections ?? {}
    const allConnected = Object.values(connections).every((c) => c.connected)

    return NextResponse.json({ toolkits, connections, allConnected })
  } catch (error) {
    console.error("[mcp] auth route error:", error)
    return NextResponse.json({ error: "Failed to check auth status" }, { status: 500 })
  }
}
