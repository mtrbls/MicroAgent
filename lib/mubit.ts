import { Client } from "@mubit-ai/sdk"
import type { Mate } from "./types"

let cachedClient: Client | null = null

function getMubitClient(): Client | null {
  if (!process.env.MUBIT_API_KEY) return null
  if (cachedClient) return cachedClient
  cachedClient = new Client({ apiKey: process.env.MUBIT_API_KEY })
  return cachedClient
}

/**
 * Register a freshly-forged mate as a MuBit agent so its memory + reflection
 * loop is properly scoped. Non-fatal: any error is logged but doesn't break
 * the forge flow. No-op when MUBIT_API_KEY isn't set.
 */
export async function registerMateOnMubit(
  mate: Pick<
    Mate,
    "id" | "name" | "archetype" | "tagline" | "tools" | "system_prompt_template"
  >
): Promise<void> {
  const client = getMubitClient()
  if (!client) return
  try {
    await client.registerAgent({
      agent_id: mate.id,
      role: `${mate.archetype}: ${mate.tagline}`,
      capabilities: (mate.tools ?? []).map((t) => t.mcp_server),
      session_id: `mate-${mate.id}`,
    })
  } catch (err) {
    console.error("[mubit] registerAgent failed:", err)
  }
}
