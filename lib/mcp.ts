import { Composio } from "@composio/core"
import type { Mate, MCPToolBinding } from "./types"

// Map our internal tool names to Composio toolkit names
const TOOLKIT_MAP: Record<string, string> = {
  gmail: "gmail",
  calendar: "googlecalendar",
  "web-search": "serpapi",
  github: "github",
}

// Get the toolkits a mate needs based on their tool bindings
export function getToolkitsForMate(mate: Mate): string[] {
  const toolkits = new Set<string>()
  const bindings = mate.tools as MCPToolBinding[]

  for (const binding of bindings) {
    const toolkit = TOOLKIT_MAP[binding.mcp_server]
    if (toolkit) {
      toolkits.add(toolkit)
    }
  }

  return Array.from(toolkits)
}

// Create a Composio session for a mate and get tools
export async function createComposioSession(mate: Mate, userId: string) {
  if (!process.env.COMPOSIO_API_KEY) {
    console.log("[v0] COMPOSIO_API_KEY not set")
    return null
  }

  const toolkits = getToolkitsForMate(mate)

  if (toolkits.length === 0) {
    return null
  }

  const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY })
  const entityId = `${userId}_${mate.id}`

  try {
    // Create a session for this user
    const session = await composio.create(entityId, {
      toolkits,
    })

    return session
  } catch (error) {
    console.error("[v0] Error creating Composio session:", error)
    return null
  }
}

// Get tools for a mate - returns AI SDK compatible tools
export async function getToolsForMate(mate: Mate, userId: string) {
  const session = await createComposioSession(mate, userId)

  if (!session) {
    return null
  }

  // Check if auth is needed
  if (session.pendingAuthUrl) {
    console.log("[v0] Auth required for mate tools:", session.pendingAuthUrl)
    return { requiresAuth: true, authUrl: session.pendingAuthUrl, tools: null }
  }

  try {
    // Get tools from the session
    const tools = await session.tools()
    return { requiresAuth: false, authUrl: null, tools }
  } catch (error) {
    console.error("[v0] Error getting tools from session:", error)
    return null
  }
}
