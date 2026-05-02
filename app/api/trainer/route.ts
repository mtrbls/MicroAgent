import { sql, DEFAULT_USER_ID } from "@/db"
import { trainerModel } from "@/lib/ai"
import { streamText, tool, convertToModelMessages, stepCountIs, UIMessage } from "ai"
import { z } from "zod"

export const maxDuration = 60

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json()

  // Load user's mates for context
  const mates = await sql`
    SELECT id, name, archetype, tagline, status, on_active_squad, level, episode_count
    FROM mates 
    WHERE user_id = ${DEFAULT_USER_ID} AND is_recruited = true
  `

  const mateList = mates
    .map(
      (m) =>
        `- ${m.name} (${m.archetype}): ${m.tagline} [Level ${m.level}, ${m.episode_count} episodes, ${m.on_active_squad ? "active" : "benched"}]`
    )
    .join("\n")

  const systemPrompt = `You are the Trainer, an orchestration AI that helps users manage their team of AI mates.

The user's current team:
${mateList || "No mates recruited yet."}

You can:
1. Route tasks to specific mates using summon_mate
2. Help create new custom mates using forge_mate
3. Manage the active squad (max 6) using swap_squad
4. Provide summaries of mate activity using inspect_mate

Always be helpful and suggest which mate might handle a task. If no mate fits, suggest forging a new one.
Keep responses concise. When a mate is summoned, let the user know which mate is handling it.`

  const result = streamText({
    model: trainerModel,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      summon_mate: tool({
        description: "Summon a specific mate to handle a task",
        inputSchema: z.object({
          mate_id: z.string().describe("The ID of the mate to summon"),
          task: z.string().describe("The task description for the mate"),
        }),
        execute: async ({ mate_id, task }) => {
          // Call the mate's act endpoint internally
          const response = await fetch(
            `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/mate/${mate_id}/act`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ task }),
            }
          )

          if (!response.ok) {
            return { error: "Failed to summon mate", status: response.status }
          }

          // For now, return a simple confirmation
          const mate = mates.find((m) => m.id === mate_id)
          return {
            success: true,
            mate: mate?.name || mate_id,
            task,
            message: `${mate?.name || "Mate"} is working on: ${task}`,
          }
        },
      }),

      forge_mate: tool({
        description: "Start the process of creating a new custom mate",
        inputSchema: z.object({
          description: z.string().describe("Description of the mate to create"),
        }),
        execute: async ({ description }) => {
          return {
            action: "open_forge",
            description,
            message: `Opening the forge to create a new mate based on: ${description}`,
          }
        },
      }),

      swap_squad: tool({
        description: "Swap a mate into or out of the active squad",
        inputSchema: z.object({
          action: z.enum(["promote", "demote", "swap"]).describe("The action to take"),
          mate_id: z.string().optional().describe("The mate to promote or demote"),
          in_id: z.string().optional().describe("For swap: the mate to bring in"),
          out_id: z.string().optional().describe("For swap: the mate to remove"),
        }),
        execute: async ({ action, mate_id, in_id, out_id }) => {
          const body =
            action === "swap"
              ? { action, inId: in_id, outId: out_id }
              : { action, mateId: mate_id }

          const response = await fetch(
            `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/squad`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          )

          if (!response.ok) {
            return { error: "Failed to update squad" }
          }

          return { success: true, action, message: `Squad updated: ${action}` }
        },
      }),

      inspect_mate: tool({
        description: "Get a summary of a mate's recent activity",
        inputSchema: z.object({
          mate_id: z.string().describe("The mate ID to inspect"),
        }),
        execute: async ({ mate_id }) => {
          const episodes = await sql`
            SELECT action_taken, outcome, timestamp 
            FROM episodes 
            WHERE mate_id = ${mate_id}
            ORDER BY timestamp DESC
            LIMIT 5
          `

          const mate = mates.find((m) => m.id === mate_id)

          return {
            mate: mate?.name || mate_id,
            level: mate?.level,
            episode_count: mate?.episode_count,
            recent_actions: episodes.map((e) => ({
              action: e.action_taken,
              outcome: e.outcome,
              when: e.timestamp,
            })),
          }
        },
      }),
    },
    stopWhen: stepCountIs(5),
    abortSignal: request.signal,
  })

  return result.toUIMessageStreamResponse()
}
