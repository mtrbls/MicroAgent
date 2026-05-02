import { sql } from "@/db"
import { getUserId } from "@/lib/auth"
import { DEFAULT_MATES } from "@/lib/default-mates"
import { registerMateOnMubit } from "@/lib/mubit"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    const userId = await getUserId()

    // Schema bootstrap. All idempotent — NO-OPs once the table exists
    // with the right columns. Done here (rather than at sign-up) because
    // mates ownership flows through this route.
    await sql`
      CREATE TABLE IF NOT EXISTS mates (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        archetype TEXT NOT NULL,
        avatar_shape TEXT,
        color TEXT,
        tagline TEXT,
        voice JSONB,
        system_prompt_template TEXT,
        tools JSONB,
        confidence_threshold REAL DEFAULT 0.7,
        level INTEGER NOT NULL DEFAULT 1,
        episode_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'idle',
        last_active TIMESTAMPTZ,
        on_active_squad BOOLEAN NOT NULL DEFAULT false,
        is_recruited BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    await sql`ALTER TABLE mates ADD COLUMN IF NOT EXISTS schedule JSONB`
    await sql`ALTER TABLE mates ADD COLUMN IF NOT EXISTS experience INTEGER NOT NULL DEFAULT 0`
    await sql`CREATE INDEX IF NOT EXISTS mates_user_id_idx ON mates (user_id)`

    // Feedback dedupe log: one verdict per (mate, reference, kind) — see
    // the feedback route for the INSERT ... ON CONFLICT pattern.
    await sql`
      CREATE TABLE IF NOT EXISTS feedback_log (
        mate_id TEXT NOT NULL,
        reference_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (mate_id, reference_id, kind)
      )
    `

    // Per-user scoped mate ids. Default-pack mate `mate_default_classify`
    // becomes `${userId}_mate_default_classify` for this user, so two users
    // can both seed the pack without colliding on mates.id (PK).
    const scopedId = (m: { id: string }) => `${userId}_${m.id}`
    const newIds = new Set(DEFAULT_MATES.map(scopedId))

    // Soft-archive any default mates from prior seed versions that are no
    // longer in the pack.
    const existing = await sql`
      SELECT id FROM mates WHERE user_id = ${userId}
    `
    const prefix = `${userId}_mate_default_`
    let archived = 0
    for (const row of existing) {
      const id = row.id as string
      if (id.startsWith(prefix) && !newIds.has(id)) {
        await sql`UPDATE mates SET is_recruited = false WHERE id = ${id}`
        archived++
      }
    }

    // Upsert the current pack. Refinements to system prompts / taglines /
    // voice land for users who seeded an earlier version.
    for (const m of DEFAULT_MATES) {
      const id = scopedId(m)
      await sql`
        INSERT INTO mates (
          id, user_id, name, archetype, avatar_shape, color, tagline,
          voice, system_prompt_template, tools, confidence_threshold,
          level, episode_count, status, on_active_squad, is_recruited
        ) VALUES (
          ${id},
          ${userId},
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

    // Register starter pack on MuBit, scoped per user-mate.
    await Promise.all(
      DEFAULT_MATES.map((m) =>
        registerMateOnMubit({
          id: scopedId(m),
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
