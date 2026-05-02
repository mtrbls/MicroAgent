import { sql, DEFAULT_USER_ID } from "@/db"
import { DEFAULT_MATES } from "@/lib/default-mates"
import { registerMateOnMubit } from "@/lib/mubit"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    // Lightweight schema migration: ensure the schedule column exists. Safe
    // to run on every seed (NO-OP if it already exists).
    await sql`ALTER TABLE mates ADD COLUMN IF NOT EXISTS schedule JSONB`

    const newIds = new Set(DEFAULT_MATES.map((m) => m.id))

    // Soft-archive any default mates from prior seed versions that are no
    // longer in the pack so the list stays clean.
    const existing = await sql`
      SELECT id FROM mates
      WHERE user_id = ${DEFAULT_USER_ID} AND id LIKE 'mate_default_%'
    `
    let archived = 0
    for (const row of existing) {
      const id = row.id as string
      if (!newIds.has(id)) {
        await sql`UPDATE mates SET is_recruited = false WHERE id = ${id}`
        archived++
      }
    }

    // Upsert the current pack so refinements to system prompts / taglines /
    // voice land for users who seeded an earlier version.
    for (const m of DEFAULT_MATES) {
      await sql`
        INSERT INTO mates (
          id, user_id, name, archetype, avatar_shape, color, tagline,
          voice, system_prompt_template, tools, confidence_threshold,
          level, episode_count, status, on_active_squad, is_recruited
        ) VALUES (
          ${m.id},
          ${DEFAULT_USER_ID},
          ${m.name},
          ${m.archetype},
          ${m.avatar_shape},
          ${m.color},
          ${m.tagline},
          ${JSON.stringify(m.voice)},
          ${m.system_prompt_template},
          ${JSON.stringify(m.tools)},
          ${m.confidence_threshold},
          1,
          0,
          'idle',
          false,
          true
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          archetype = EXCLUDED.archetype,
          avatar_shape = EXCLUDED.avatar_shape,
          color = EXCLUDED.color,
          tagline = EXCLUDED.tagline,
          voice = EXCLUDED.voice,
          system_prompt_template = EXCLUDED.system_prompt_template,
          tools = EXCLUDED.tools,
          confidence_threshold = EXCLUDED.confidence_threshold,
          is_recruited = true
      `
    }

    // Register starter pack on MuBit (idempotent in-runtime via internal
    // Set; non-fatal if MUBIT_API_KEY isn't set or the call fails).
    await Promise.all(
      DEFAULT_MATES.map((m) =>
        registerMateOnMubit({
          id: m.id,
          name: m.name,
          archetype: m.archetype,
          tagline: m.tagline,
          tools: m.tools,
          system_prompt_template: m.system_prompt_template,
        })
      )
    )

    return NextResponse.json({
      success: true,
      synced: DEFAULT_MATES.length,
      archived,
    })
  } catch (error) {
    console.error("[seed] error:", error)
    return NextResponse.json({ error: "Failed to seed default mates" }, { status: 500 })
  }
}
