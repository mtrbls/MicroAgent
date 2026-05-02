import { Composio } from "@composio/core"
import { VercelProvider } from "@composio/vercel"
import type { Mate, MCPToolBinding } from "./types"

// Map our internal tool names to Composio toolkit slugs
const TOOLKIT_MAP: Record<string, string> = {
  gmail: "GMAIL",
  calendar: "GOOGLECALENDAR",
  "web-search": "SERPAPI",
  github: "GITHUB",
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

// Create a Composio client with VercelProvider
function getComposio() {
  const apiKey = process.env.COMPOSIO_API_KEY
  if (!apiKey) {
    console.log("[v0] COMPOSIO_API_KEY not set")
    return null
  }
  return new Composio({ 
    apiKey,
    baseURL: "https://backend.composio.dev",
    provider: new VercelProvider() 
  })
}

// Create a session for a user/mate and get tools
export async function getToolsForMate(mate: Mate, userId: string) {
  const composio = getComposio()
  if (!composio) return null

  const toolkits = getToolkitsForMate(mate)
  if (toolkits.length === 0) return null

  const entityId = `${userId}_${mate.id}`

  try {
    const session = await composio.create(entityId)
    const tools = await session.tools({ toolkits })
    
    return { requiresAuth: false, authUrl: null, tools }
  } catch (error: unknown) {
    console.error("[v0] Composio getTools error:", error)
    
    // Check if this is an auth required error
    const errMsg = error instanceof Error ? error.message : String(error)
    if (errMsg.includes("auth") || errMsg.includes("connect") || errMsg.includes("No connected account")) {
      try {
        const session = await composio.create(entityId)
        const authUrl = await session.getAuthUrl(toolkits[0])
        return { requiresAuth: true, authUrl, tools: null }
      } catch (authError) {
        console.error("[v0] Error getting auth URL:", authError)
      }
    }
    
    return null
  }
}

// Check auth status and get auth URL if needed
export async function checkAuthStatus(mate: Mate, userId: string) {
  const composio = getComposio()
  if (!composio) return { error: "COMPOSIO_API_KEY not configured" }

  const toolkits = getToolkitsForMate(mate)
  if (toolkits.length === 0) return { connections: {} }

  const entityId = `${userId}_${mate.id}`
  const connections: Record<string, { connected: boolean; authUrl?: string }> = {}

  try {
    const session = await composio.create(entityId)
    
    for (const toolkit of toolkits) {
      try {
        // Try to get tools - if it works, we're connected
        await session.tools({ toolkits: [toolkit] })
        connections[toolkit.toLowerCase()] = { connected: true }
      } catch {
        // Need auth - get the URL
        try {
          const authUrl = await session.getAuthUrl(toolkit)
          connections[toolkit.toLowerCase()] = { connected: false, authUrl }
        } catch (urlError) {
          console.error(`[v0] Error getting auth URL for ${toolkit}:`, urlError)
          connections[toolkit.toLowerCase()] = { connected: false }
        }
      }
    }
    
    return { connections }
  } catch (error) {
    console.error("[v0] Error checking auth status:", error)
    return { error: String(error) }
  }
}
