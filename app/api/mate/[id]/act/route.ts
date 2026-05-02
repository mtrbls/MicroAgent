import { sql } from "@/db"
import { mateModel } from "@/lib/ai"
import { getToolsForMate, getToolkitsForMate } from "@/lib/mcp"
import type { Mate } from "@/lib/types"
import { streamText, convertToModelMessages, UIMessage, stepCountIs } from "ai"
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

    const systemPrompt = `You are ${mate.name}, a ${mate.archetype} assistant.
${mate.tagline}

Your voice: ${voice.register}
Signature phrases you use: ${voice.signature_phrases.join(", ")}
Phrases you never use: ${voice.forbidden_phrases.join(", ")}

Things you remember about the user:
- ${facts || "No memories yet."}

${mate.system_prompt_template || "Help the user with their request efficiently and in character."}

Always stay in character. Be concise but helpful.`

    const startTime = Date.now()

    // Get real tools from Composio session
    const toolkits = getToolkitsForMate(mate)
    let tools = {}

    if (toolkits.length > 0 && process.env.COMPOSIO_API_KEY) {
      try {
        const toolResult = await getToolsForMate(mate, "user_demo")
        if (toolResult?.requiresAuth) {
          return NextResponse.json(
            { error: "Authentication required", authUrl: toolResult.authUrl },
            { status: 401 }
          )
        }
        if (toolResult?.tools) {
          tools = toolResult.tools
        }
      } catch (error) {
        console.error("[v0] Failed to load tools:", error)
        // Continue without tools if loading fails
      }
    }

    // Convert messages or use task as prompt
    const modelMessages = messages
      ? await convertToModelMessages(messages)
      : [{ role: "user" as const, content: task || "Hello" }]

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

    // Update status to working
    await sql`UPDATE mates SET status = 'working' WHERE id = ${id}`

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("Error in mate action:", error)
    return NextResponse.json({ error: "Failed to execute mate action" }, { status: 500 })
  }
}
