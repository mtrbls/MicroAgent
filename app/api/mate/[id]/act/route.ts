import { sql, DEFAULT_USER_ID } from "@/db"
import { mateModel } from "@/lib/ai"
import { getToolsForMate, getToolkitsForMate } from "@/lib/mcp"
import type { Mate } from "@/lib/types"
import {
  streamText,
  convertToModelMessages,
  wrapLanguageModel,
  UIMessage,
  stepCountIs,
  type ToolSet,
} from "ai"
import { mubitMemoryMiddleware } from "@mubit-ai/ai-sdk"
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

You exist to perform exactly ONE action. When invoked, just DO it for non-destructive actions (briefing, listing, drafting). Do NOT ask clarifying questions for missing parameters — use sensible defaults from your system prompt. If the user asks for anything outside your one action, politely decline in one short sentence and remind them what you do.

DESTRUCTIVE / MUTATING actions are different. Sending an email, deleting, creating or modifying calendar events, applying or removing labels, writing to remote storage — for any of these, you MUST:
  1. Preview the plan: state exactly what you'll do and the count of items affected (e.g. "I'll create 5 Deep Focus blocks Tue-Fri at 9am.").
  2. Wait for the user's explicit confirmation ('yes', 'go ahead', 'do it') before calling the mutation tool.
Drafts the user manually sends, and read-only summaries, are NOT destructive — execute those without asking.

Your voice: ${voice.register}
Signature phrases you use: ${voice.signature_phrases.join(", ")}
Phrases you never use: ${voice.forbidden_phrases.join(", ")}

Things you remember about the user:
- ${facts || "No memories yet."}
${toolkitsLine}

${mate.system_prompt_template || "Perform your one action efficiently and in character."}

Stay in character. Be concise. One action per request — no multi-step side quests, no asking.`

    // Convert messages or use task as prompt
    const modelMessages = messages
      ? await convertToModelMessages(messages)
      : [{ role: "user" as const, content: task || "Hello" }]

    await sql`UPDATE mates SET status = 'working' WHERE id = ${id}`

    // Wrap the model with MuBit memory middleware so the agent learns over
    // time: lessons relevant to this agent + query are auto-injected before
    // the call, the interaction is captured after, and accumulated lessons
    // shape future runs. No-op if MUBIT_API_KEY isn't set.
    const model = process.env.MUBIT_API_KEY
      ? wrapLanguageModel({
          model: mateModel,
          // The middleware works at runtime across AI SDK v4-v6, but its
          // type doesn't yet include the v6 `specificationVersion` field.
          // Cast through unknown to satisfy the v6 generic.
          middleware: mubitMemoryMiddleware({
            apiKey: process.env.MUBIT_API_KEY,
            sessionId: `mate-${id}`,
            agentId: id,
            captureMode: "await",
          }) as unknown as Parameters<typeof wrapLanguageModel>[0]["middleware"],
        })
      : mateModel

    const result = streamText({
      model,
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
