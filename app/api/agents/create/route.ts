import { sql } from "@/db"
import { getUserId } from "@/lib/auth"
import { createAgentModel } from "@/lib/ai"
import { TOOLKIT_MAP } from "@/lib/mcp"
import { registerMateOnMubit } from "@/lib/mubit"
import { generateText, Output } from "ai"
import { z } from "zod"

export const maxDuration = 60

const AVATAR_SHAPES = ["circle", "hexagon", "triangle", "square", "diamond", "oval"] as const
const ARCHETYPES = [
  "correspondence",
  "scheduler",
  "research",
  "money",
  "health",
  "memory",
  "code",
  "deals",
  "custom",
] as const
const REGISTERS = ["formal", "casual", "terse", "warm"] as const
const MCP_SERVERS = Object.keys(TOOLKIT_MAP) as [string, ...string[]]

const TOOLKIT_LIST = MCP_SERVERS.map((k) => `- ${k}`).join("\n")

export async function POST(request: Request) {
  const { description } = (await request.json()) as { description?: string }
  if (!description || !description.trim()) {
    return new Response(JSON.stringify({ error: "Missing description" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const userId = await getUserId()

  // Server-Sent-Events stream — each step pushes a JSON event so the UI
  // can show progress instead of a long blank loader.
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        // Step 1: name + archetype
        send({ step: "name", status: "start", label: "Naming the agent..." })
        const step1 = await generateText({
          model: createAgentModel,
          prompt: `A "mate" is a single-purpose AI assistant that performs ONE specific repeatable action.

User's description: "${description}"

Generate a short, memorable name (1-2 syllables) and the best archetype.

Archetypes: correspondence (emails/messages), scheduler (calendar/meetings), research (finding info), money (finances/invoices), health (fitness/wellness), memory (notes/recall), code (programming), deals (finding bargains), custom (other).`,
          output: Output.object({
            schema: z.object({
              name: z.string(),
              archetype: z.enum(ARCHETYPES),
              reasoning: z.string(),
            }),
          }),
        })
        const { name, archetype } = step1.output
        send({ step: "name", status: "done", value: name, archetype })

        // Step 2: avatar + color
        send({ step: "avatar", status: "start", label: "Picking avatar..." })
        const step2 = await generateText({
          model: createAgentModel,
          prompt: `For "${name}" (${archetype}, ${description}): choose an avatar shape and a muted hex color.

Shapes: circle (friendly), hexagon (organized), triangle (alert), square (solid), diamond (clever), oval (gentle).`,
          output: Output.object({
            schema: z.object({
              avatar_shape: z.enum(AVATAR_SHAPES),
              color: z.string().describe("Hex color like #5B7C99"),
            }),
          }),
        })
        const { avatar_shape, color } = step2.output
        send({ step: "avatar", status: "done", value: avatar_shape, color })

        // Step 3: voice
        send({ step: "voice", status: "start", label: "Defining voice..." })
        const step3 = await generateText({
          model: createAgentModel,
          prompt: `For "${name}" (${archetype}): ${description}

Define their voice:
- Register: formal, casual, terse, or warm
- 3-4 signature phrases
- 2-3 phrases they would never say`,
          output: Output.object({
            schema: z.object({
              register: z.enum(REGISTERS),
              signature_phrases: z.array(z.string()),
              forbidden_phrases: z.array(z.string()),
            }),
          }),
        })
        const voice = step3.output
        send({ step: "voice", status: "done", value: voice.register })

        // Step 4: toolkits — primary + up to 2 secondaries
        send({ step: "tools", status: "start", label: "Choosing tools..." })
        const step4 = await generateText({
          model: createAgentModel,
          prompt: `Mate "${name}" (${archetype}) does this action: ${description}

Pick the MCP toolkits this agent needs from the list below. Output a primary toolkit (the most central one) and 0-2 secondaries (only if the action genuinely crosses tools — e.g. "draft a Slack post from yesterday's GitHub commits" needs github + slack).

Available toolkits:
${TOOLKIT_LIST}

Be conservative — most agents only need the primary.`,
          output: Output.object({
            schema: z.object({
              primary: z.enum(MCP_SERVERS),
              secondary: z.array(z.enum(MCP_SERVERS)).max(2),
              scope: z.array(z.string()).describe("Specific operations needed"),
            }),
          }),
        })

        const allServers = [step4.output.primary, ...step4.output.secondary]
        const tools = Array.from(new Set(allServers))
          .filter((s) => s in TOOLKIT_MAP)
          .map((s) => ({
            mcp_server: s,
            scope: step4.output.scope,
            mcp_url: `composio://${TOOLKIT_MAP[s]}`,
          }))
        send({
          step: "tools",
          status: "done",
          value: tools.map((t) => t.mcp_server).join(", ") || "none",
        })

        // Step 5: system prompt + tagline + confidence
        send({ step: "prompt", status: "start", label: "Writing system prompt..." })
        const step5 = await generateText({
          model: createAgentModel,
          prompt: `Mate "${name}" (${archetype}) does exactly ONE action: ${description}
Toolkits available to it: ${tools.map((t) => t.mcp_server).join(", ") || "none"}

Create:
1. A short tagline (under 50 chars), imperative-style ("Delete promo emails", "Triage tickets").
2. An initial confidence threshold (0.6-0.9, lower = more cautious).
3. A system_prompt_template that:
   - Opens with: "Your one job is to ${"<single action>"}."
   - Forbids tasks outside that action.
   - Spells out sensible defaults inline so the mate never asks the user.
   - Non-destructive actions: just do it.
   - Destructive/mutating actions (send/delete/create/label/write): preview-then-confirm — show count and wait for the user's explicit 'yes' before calling the mutation tool.
   - Under 700 chars.`,
          output: Output.object({
            schema: z.object({
              tagline: z.string(),
              confidence_threshold: z.number(),
              system_prompt_template: z.string(),
            }),
          }),
        })
        const { tagline, confidence_threshold, system_prompt_template } = step5.output
        send({ step: "prompt", status: "done", value: tagline })

        // Persist + register
        send({ step: "save", status: "start", label: "Saving..." })
        const id = `${userId}_mate_${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}_${Date.now().toString(36)}`
        await sql`
          INSERT INTO mates (
            id, user_id, name, archetype, avatar_shape, color, tagline,
            voice, system_prompt_template, tools, confidence_threshold,
            level, episode_count, status, on_active_squad, is_recruited,
            created_at
          ) VALUES (
            ${id},
            ${userId},
            ${name},
            ${archetype},
            ${avatar_shape},
            ${color},
            ${tagline},
            ${JSON.stringify(voice)},
            ${system_prompt_template},
            ${JSON.stringify(tools)},
            ${confidence_threshold},
            1,
            0,
            'idle',
            false,
            true,
            NOW()
          )
        `
        // Fire-and-forget MuBit registration
        registerMateOnMubit({ id, name, archetype, tagline, tools, system_prompt_template }).catch(
          (err) => console.error("[create-agent] mubit register failed:", err)
        )

        send({
          step: "done",
          status: "done",
          mate: {
            id,
            name,
            archetype,
            avatar_shape,
            color,
            tagline,
            voice,
            tools,
            confidence_threshold,
            system_prompt_template,
          },
        })
        controller.close()
      } catch (err) {
        console.error("[create-agent] failed:", err)
        send({ step: "error", status: "error", message: "Could not create agent. Try again. Try again." })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}
