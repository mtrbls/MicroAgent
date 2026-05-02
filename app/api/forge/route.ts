import { sql, DEFAULT_USER_ID } from "@/db"
import { forgeFinalModel } from "@/lib/ai"
import { TOOLKIT_MAP } from "@/lib/mcp"
import { generateText, Output } from "ai"
import { z } from "zod"
import { NextResponse } from "next/server"

export const maxDuration = 60

const AVATAR_SHAPES = ["circle", "hexagon", "triangle", "square", "diamond", "oval"] as const
const ARCHETYPES = ["correspondence", "scheduler", "research", "money", "health", "memory", "code", "deals", "custom"] as const
const REGISTERS = ["formal", "casual", "terse", "warm"] as const
const MCP_SERVERS = Object.keys(TOOLKIT_MAP) as [string, ...string[]]

export async function POST(request: Request) {
  const { description } = await request.json()

  try {
    // Step 1: Name + archetype. A mate does ONE specific action — name should
    // hint at the action, archetype anchors the domain.
    const step1 = await generateText({
      model: forgeFinalModel,
      prompt: `A "mate" is a single-purpose AI assistant that performs ONE specific repeatable action (e.g. "delete promotional emails older than 7 days", "block 30 min of focus time every weekday morning", "label invoices and forward to my accountant").

User's description of the action they want a mate for: "${description}"

Generate a short, memorable name (1-2 syllables, easy to say) and the best archetype for the action.

Archetypes: correspondence (emails/messages), scheduler (calendar/meetings), research (finding info), money (finances/invoices), health (fitness/wellness), memory (notes/recall), code (programming), deals (finding bargains), custom (other).`,
      output: Output.object({
        schema: z.object({
          name: z.string().describe("Short memorable name, 1-2 syllables"),
          archetype: z.enum(ARCHETYPES),
          reasoning: z.string().describe("Brief explanation"),
        }),
      }),
    })

    const { name, archetype } = step1.output

    // Step 2: Avatar + color
    const step2 = await generateText({
      model: forgeFinalModel,
      prompt: `For an AI assistant named "${name}" with archetype "${archetype}" (${description}):

Choose an avatar shape and a muted, professional hex color that fits the personality.

Shapes: circle (friendly), hexagon (organized), triangle (alert), square (solid), diamond (clever), oval (gentle).`,
      output: Output.object({
        schema: z.object({
          avatar_shape: z.enum(AVATAR_SHAPES),
          color: z.string().describe("Hex color code like #5B7C99"),
        }),
      }),
    })

    const { avatar_shape, color } = step2.output

    // Step 3: Voice spec
    const step3 = await generateText({
      model: forgeFinalModel,
      prompt: `For an AI assistant named "${name}" (${archetype}): ${description}

Define their voice:
- Register: formal (professional), casual (friendly), terse (brief), warm (empathetic)
- 3-4 signature phrases they use naturally
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

    // Step 4: Tool. Each mate gets exactly ONE primary toolkit — pick the
    // single best fit for the action.
    const step4 = await generateText({
      model: forgeFinalModel,
      prompt: `Mate "${name}" (${archetype}) has ONE specific action to perform: ${description}

Pick the SINGLE most appropriate MCP toolkit for that action. Available toolkits:
- gmail (draft, send, search, label, delete)
- calendar (read, create, update)
- web-search (search, fetch)
- github (read, create_issue, create_pr)
- slack (send, search)
- notion (read, create, update)

Choose exactly one.`,
      output: Output.object({
        schema: z.object({
          mcp_server: z.enum(MCP_SERVERS),
          scope: z.array(z.string()).describe("Specific operations needed"),
        }),
      }),
    })

    const tools =
      step4.output.mcp_server in TOOLKIT_MAP
        ? [
            {
              mcp_server: step4.output.mcp_server,
              scope: step4.output.scope,
              mcp_url: `composio://${TOOLKIT_MAP[step4.output.mcp_server]}`,
            },
          ]
        : []

    // Step 5: System prompt + tagline + confidence. The system prompt must
    // bake in the single-action constraint — the mate does this one thing,
    // nothing else.
    const step5 = await generateText({
      model: forgeFinalModel,
      prompt: `Mate "${name}" (${archetype}) does exactly ONE action: ${description}
Their toolkit: ${tools[0]?.mcp_server ?? "none"}

Create:
1. A short tagline (under 50 chars) that names the single action — written like an imperative ("Delete promo emails", "Block focus time", "Triage GitHub issues").
2. An initial confidence threshold (0.6-0.9, lower = more cautious).
3. A system_prompt_template that locks the mate to this one action. It must:
   - Open with: "Your one job is to ${"<single action>"}."
   - Forbid the mate from doing tasks outside that action — if asked, politely decline and remind the user what they do.
   - If the action mutates external state (sending email, deleting, creating/modifying calendar events, applying labels, writing remote data), require an explicit confirmation step: preview the plan with a count, then wait for the user's 'yes' before calling any mutation tool.
   - Be concise (under 700 chars).`,
      output: Output.object({
        schema: z.object({
          tagline: z.string(),
          confidence_threshold: z.number(),
          system_prompt_template: z.string(),
        }),
      }),
    })

    const { tagline, confidence_threshold, system_prompt_template } = step5.output

    // Generate unique ID
    const id = `mate_${name.toLowerCase()}_${Date.now().toString(36)}`

    // Insert into database
    await sql`
      INSERT INTO mates (
        id, user_id, name, archetype, avatar_shape, color, tagline,
        voice, system_prompt_template, tools, confidence_threshold,
        level, episode_count, status, on_active_squad, is_recruited
      ) VALUES (
        ${id},
        ${DEFAULT_USER_ID},
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
        true
      )
    `

    return NextResponse.json({
      success: true,
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
  } catch (error) {
    console.error("Forge error:", error)
    return NextResponse.json(
      { error: "Failed to forge mate" },
      { status: 500 }
    )
  }
}
