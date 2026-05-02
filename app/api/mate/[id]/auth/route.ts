import { sql } from "@/db"
import { checkMateAuth, getToolkitsForMate } from "@/lib/mcp"
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
        authenticated: true,
        toolkits: [],
        message: "This mate doesn't require any external integrations",
      })
    }

    // Check if Composio is configured
    if (!process.env.COMPOSIO_API_KEY) {
      return NextResponse.json({
        authenticated: false,
        toolkits,
        error: "COMPOSIO_API_KEY not configured",
        message: "Add your Composio API key to enable integrations",
      })
    }

    // Check auth status with Composio
    const authStatus = await checkMateAuth(mate, "user_demo")

    return NextResponse.json({
      authenticated: authStatus.authenticated,
      toolkits,
      authUrl: authStatus.authUrl,
      missingToolkits: authStatus.missingToolkits,
      message: authStatus.authenticated
        ? `Connected to ${toolkits.join(", ")}`
        : `Please authenticate with ${authStatus.missingToolkits.join(", ")}`,
    })
  } catch (error) {
    console.error("Error checking mate auth:", error)
    return NextResponse.json({ error: "Failed to check auth status" }, { status: 500 })
  }
}
