import { Composio } from "@composio/core"
import { VercelProvider } from "@composio/vercel"
import type { Mate, ToolBinding } from "./types"

// Map our internal mcp_server names to Composio toolkit slugs (lowercase).
export const TOOLKIT_MAP: Record<string, string> = {
  gmail: "gmail",
  calendar: "googlecalendar",
  "web-search": "serpapi",
  github: "github",
  slack: "slack",
  notion: "notion",
}

export type ToolkitConnection = { connected: boolean; authUrl?: string }

export function getToolkitsForMate(mate: Mate): string[] {
  const toolkits = new Set<string>()
  const bindings = (mate.tools ?? []) as ToolBinding[]
  for (const binding of bindings) {
    const toolkit = TOOLKIT_MAP[binding.mcp_server]
    if (toolkit) toolkits.add(toolkit)
  }
  return Array.from(toolkits)
}

function getComposio() {
  const apiKey = process.env.COMPOSIO_API_KEY
  if (!apiKey) return null
  return new Composio({ apiKey, provider: new VercelProvider() })
}

async function createSession(mate: Mate, userId: string) {
  const composio = getComposio()
  if (!composio) return null
  const toolkits = getToolkitsForMate(mate)
  if (toolkits.length === 0) return null
  const session = await composio.create(userId, { toolkits })
  return { session, toolkits }
}

// Returns AI-SDK-shaped tools for a mate. Returns empty when no toolkits or
// no API key configured. Errors fall back to no tools so chat still works.
export async function getToolsForMate(mate: Mate, userId: string) {
  try {
    const created = await createSession(mate, userId)
    if (!created) return null
    const tools = await created.session.tools()
    return { tools, toolkits: created.toolkits }
  } catch (error) {
    console.error("[mcp] getToolsForMate failed:", error)
    return null
  }
}

// Inspect connection state for the mate's toolkits and produce auth URLs
// for any not yet connected.
export async function checkAuthStatus(mate: Mate, userId: string) {
  const composio = getComposio()
  if (!composio) return { error: "COMPOSIO_API_KEY not configured" as const }

  const toolkits = getToolkitsForMate(mate)
  if (toolkits.length === 0) return { connections: {} as Record<string, ToolkitConnection> }

  try {
    const session = await composio.create(userId, { toolkits })
    const status = await session.toolkits()

    const connections: Record<string, ToolkitConnection> = {}
    for (const item of status.items) {
      const slug = item.slug.toLowerCase()
      const isConnected = item.connection?.isActive === true || item.isNoAuth === true
      if (isConnected) {
        connections[slug] = { connected: true }
        continue
      }
      try {
        const req = await session.authorize(item.slug)
        connections[slug] = { connected: false, authUrl: req.redirectUrl ?? undefined }
      } catch (err) {
        console.error(`[mcp] authorize failed for ${item.slug}:`, err)
        connections[slug] = { connected: false }
      }
    }
    return { connections }
  } catch (error) {
    console.error("[mcp] checkAuthStatus failed:", error)
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
