import { sql, DEFAULT_USER_ID } from "@/db"
import { forgeFinalModel } from "@/lib/ai"
import { generateText, Output } from "ai"
import { z } from "zod"
import { NextResponse } from "next/server"

export const maxDuration = 60

const AVATAR_SHAPES = ["circle", "hexagon", "triangle", "square", "diamond", "oval"] as const
const ARCHETYPES = ["correspondence", "scheduler", "research", "money", "health", "memory", "code", "deals", "custom"] as const
const REGISTERS = ["formal", "casual", "terse", "warm"] as const

export async function POST(request: Request) {
  const { description } = await request.json()

  try {
    // Step 1: Name + archetype
    const step1 = await generateText({
      model: forgeFinalModel,
      prompt: `Based on this description of an AI assistant: "${description}"

Generate a short, memorable name (1-2 syllables, easy to say) and determine the best archetype.

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

    // Step 4: Tools
    const step4 = await generateText({
      model: forgeFinalModel,
      prompt: `For an AI assistant named "${name}" (${archetype}): ${description}

What MCP tools would this assistant need? Available servers:
- gmail (draft, send, search, label)
- calendar (read, create, update)
- web-search (search, fetch)
- github (read, create_issue, create_pr)
- slack (send, search)
- notion (read, create, update)

List only the ones that make sense for this assistant.`,
      output: Output.object({
        schema: z.object({
          tools: z.array(
            z.object({
              mcp_server: z.string(),
              scope: z.array(z.string()),
            })
          ),
        }),
      }),
    })

    const tools = step4.output.tools.map((t) => ({
      ...t,
      mcp_url: `https://mcp.vercel.com/${t.mcp_server}`,
    }))

    // Step 5: System prompt + tagline + confidence
    const step5 = await generateText({
      model: forgeFinalModel,
      prompt: `For an AI assistant named "${name}" (${archetype}): ${description}

Create:
1. A short tagline (under 50 chars) describing what they do
2. An initial confidence threshold (0.6-0.9, lower = more cautious)
3. A system prompt template that defines their behavior`,
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
