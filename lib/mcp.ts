import type { Mate } from "./types"

export function getMCPTools(mate: Mate) {
  return mate.tools.flatMap((binding) =>
    binding.scope.map((toolName) => ({
      mcp_url: binding.mcp_url,
      tool_name: `${binding.mcp_server}_${toolName}`,
    }))
  )
}

// Stub MCP responses for demo purposes
export function stubMCPResponse(toolName: string, _args: Record<string, unknown>): string {
  const responses: Record<string, string> = {
    gmail_draft: "Draft created successfully",
    gmail_send: "Email sent successfully",
    gmail_search: "Found 3 relevant emails",
    gmail_label: "Labels applied successfully",
    calendar_read: "Retrieved 5 upcoming events",
    calendar_create: "Event created successfully",
    calendar_update: "Event updated successfully",
    "web-search_search": "Found relevant search results",
    "web-search_fetch": "Fetched page content successfully",
  }
  return responses[toolName] || `Executed ${toolName} successfully`
}
