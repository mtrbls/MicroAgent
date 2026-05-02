import { sql, DEFAULT_USER_ID } from "@/db"
import { DEFAULT_MATES } from "@/lib/default-mates"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    let inserted = 0
    for (const m of DEFAULT_MATES) {
      const result = await sql`
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
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `
      if (result.length > 0) inserted++
    }
    return NextResponse.json({ success: true, inserted, total: DEFAULT_MATES.length })
  } catch (error) {
    console.error("[seed] error:", error)
    return NextResponse.json({ error: "Failed to seed default mates" }, { status: 500 })
  }
}
