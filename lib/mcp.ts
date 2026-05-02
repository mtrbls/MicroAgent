import { Composio } from "@composio/core"
import { createMCPClient } from "@ai-sdk/mcp"
import type { Mate, MCPToolBinding } from "./types"

// Composio client - requires COMPOSIO_API_KEY env var
const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
})

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

// Create a Composio MCP session for a mate
export async function createMCPSession(mate: Mate, userId: string) {
  const toolkits = getToolkitsForMate(mate)
  
  if (toolkits.length === 0) {
    return null
  }
  
  // Create a tool router session for this user + mate combo
  const session = await composio.create(`${userId}_${mate.id}`, {
    toolkits,
  })
  
  return session
}

// Get MCP tools for a mate using Composio
export async function getMCPToolsForMate(mate: Mate, userId: string) {
  const session = await createMCPSession(mate, userId)
  
  if (!session) {
    return null
  }
  
  // Create MCP client connected to Composio
  const mcpClient = await createMCPClient({
    transport: {
      type: "http",
      url: session.mcp.url,
      headers: session.mcp.headers,
    },
  })
  
  // Get the tools from the MCP server
  const tools = await mcpClient.tools()
  
  return { tools, mcpClient, session }
}

// Check if a user has authenticated with the required toolkits
export async function checkMateAuth(mate: Mate, userId: string) {
  const toolkits = getToolkitsForMate(mate)
  
  if (toolkits.length === 0) {
    return { authenticated: true, missingToolkits: [], authUrl: null }
  }
  
  try {
    const session = await composio.create(`${userId}_${mate.id}`, {
      toolkits,
    })
    
    // If authUrl exists, user needs to authenticate
    if (session.authUrl) {
      return {
        authenticated: false,
        authUrl: session.authUrl,
        missingToolkits: toolkits,
      }
    }
    
    return { authenticated: true, missingToolkits: [], authUrl: null }
  } catch (error) {
    console.error("[v0] Error checking mate auth:", error)
    return {
      authenticated: false,
      missingToolkits: toolkits,
      authUrl: null,
      error: String(error),
    }
  }
}
