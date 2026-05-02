import { sql, DEFAULT_USER_ID } from "@/db"
import { mateModel } from "@/lib/ai"
import { getToolsForMate, getToolkitsForMate } from "@/lib/mcp"
import type { Mate } from "@/lib/types"
import { streamText, convertToModelMessages, UIMessage, stepCountIs, type ToolSet } from "ai"
import { NextResponse } from "next/server"

export const maxDuration = 60

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { messages, task }: { messages?: UIMessage[]; task?: string } = await request.json()

    // Load mate
    const mates = await sql`SELECT * FROM mates WHERE id = ${id}`
    if (mates.length === 0) {
      return NextResponse.json({ error: "Mate not found" }, { status: 404 })
    }
    const mate = mates[0] as unknown as Mate

    // Load memory facts
    const memoryFacts = await sql`
      SELECT fact FROM memory_facts 
      WHERE mate_id = ${id}
      ORDER BY last_referenced DESC
      LIMIT 8
    `

    // Compose system prompt
    const voice = mate.voice as { register: string; signature_phrases: string[]; forbidden_phrases: string[] }
    const facts = memoryFacts.map((f) => f.fact as string).join("\n- ")

    const startTime = Date.now()

    // Get real tools from Composio session. If anything fails (or no toolkits
    // are configured / connected), fall back to no tools so chat still works.
    const toolkits = getToolkitsForMate(mate)
    let tools: ToolSet = {}

    if (toolkits.length > 0 && process.env.COMPOSIO_API_KEY) {
      const toolResult = await getToolsForMate(mate, DEFAULT_USER_ID)
      if (toolResult?.tools) {
        tools = toolResult.tools as ToolSet
      }
    }

    const toolkitsLine =
      toolkits.length > 0
        ? `\nAvailable toolkits (via Composio tool router): ${toolkits.join(", ")}.\nUse COMPOSIO_SEARCH_TOOLS to find a specific tool, then COMPOSIO_MULTI_EXECUTE_TOOL (or the discovered tool) to call it.`
        : ""

    const systemPrompt = `You are ${mate.name}, a single-purpose ${mate.archetype} mate.
${mate.tagline}

You exist to perform exactly ONE action. Do that action when asked. If the user asks for anything outside it, politely decline in one short sentence and remind them what you do — do not improvise other tasks.

Your voice: ${voice.register}
Signature phrases you use: ${voice.signature_phrases.join(", ")}
Phrases you never use: ${voice.forbidden_phrases.join(", ")}

Things you remember about the user:
- ${facts || "No memories yet."}
${toolkitsLine}

${mate.system_prompt_template || "Perform your one action efficiently and in character."}

Stay in character. Be concise. One action per request — no multi-step side quests.`

    // Convert messages or use task as prompt
    const modelMessages = messages
      ? await convertToModelMessages(messages)
      : [{ role: "user" as const, content: task || "Hello" }]

    await sql`UPDATE mates SET status = 'working' WHERE id = ${id}`

    const result = streamText({
      model: mateModel,
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(10),
      abortSignal: request.signal,
      async onFinish({ text }) {
        // Record episode
        const episodeId = `ep_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        const duration = Date.now() - startTime

        await sql`
          INSERT INTO episodes (id, mate_id, user_input, action_taken, outcome, confidence, duration_ms)
          VALUES (
            ${episodeId},
            ${id},
            ${task || (messages ? "Chat interaction" : "")},
            ${text.slice(0, 500)},
            'completed_autonomously',
            ${mate.confidence_threshold as number},
            ${duration}
          )
        `

        // Update mate stats
        await sql`
          UPDATE mates 
          SET episode_count = episode_count + 1, 
              last_active = NOW(),
              status = 'idle'
          WHERE id = ${id}
        `
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("Error in mate action:", error)
    return NextResponse.json({ error: "Failed to execute mate action" }, { status: 500 })
  }
}
