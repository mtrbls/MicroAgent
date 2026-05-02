import { sql } from "@/db"
import { getUserId } from "@/lib/auth"
import { DEFAULT_MATES } from "@/lib/default-mates"
import { registerMateOnMubit } from "@/lib/mubit"
import { NextResponse } from "next/server"

let schemaBootstrapped = false

async function ensureMatesSchema() {
  if (schemaBootstrapped) return
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
  await Promise.all([
    sql`ALTER TABLE mates ADD COLUMN IF NOT EXISTS schedule JSONB`,
    sql`ALTER TABLE mates ADD COLUMN IF NOT EXISTS experience INTEGER NOT NULL DEFAULT 0`,
    sql`CREATE INDEX IF NOT EXISTS mates_user_id_idx ON mates (user_id)`,
    sql`
      CREATE TABLE IF NOT EXISTS feedback_log (
        mate_id TEXT NOT NULL,
        reference_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (mate_id, reference_id, kind)
      )
    `,
  ])
  schemaBootstrapped = true
}

export async function POST() {
  try {
    const userId = await getUserId()
    await ensureMatesSchema()

    const scopedId = (m: { id: string }) => `${userId}_${m.id}`
    const newIds = new Set(DEFAULT_MATES.map(scopedId))

    // Read existing mate ids once.
    const existing = (await sql`
      SELECT id FROM mates WHERE user_id = ${userId}
    `) as Array<{ id: string }>
    const existingIds = new Set(existing.map((r) => r.id))

    // Fast path: if every default mate id is already present and there
    // are no obsolete defaults to archive, skip all the writes. This is
    // the common case after the first sign-up — every subsequent home
    // page mount lands here.
    const prefix = `${userId}_mate_default_`
    const stale = existing.filter(
      (r) => r.id.startsWith(prefix) && !newIds.has(r.id)
    )
    const allPresent = DEFAULT_MATES.every((m) => existingIds.has(scopedId(m)))
    if (allPresent && stale.length === 0) {
      return NextResponse.json({ success: true, synced: 0, archived: 0, skipped: true })
    }

    // Soft-archive obsolete defaults in parallel.
    const archivePromises = stale.map(
      (r) => sql`UPDATE mates SET is_recruited = false WHERE id = ${r.id}`
    )

    // Upsert the current pack in parallel.
    const upsertPromises = DEFAULT_MATES.map((m) => {
      const id = scopedId(m)
      return sql`
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
    })

    await Promise.all([...archivePromises, ...upsertPromises])

    // Fire-and-forget MuBit registrations — these are external HTTP
    // calls that don't need to block the user from seeing their list.
    for (const m of DEFAULT_MATES) {
      registerMateOnMubit({
        id: scopedId(m),
        name: m.name,
        archetype: m.archetype,
        tagline: m.tagline,
        tools: m.tools,
        system_prompt_template: m.system_prompt_template,
      }).catch((err) => console.error("[mubit] background register failed:", err))
    }

    return NextResponse.json({
      success: true,
      synced: DEFAULT_MATES.length,
      archived: stale.length,
    })
  } catch (error) {
    console.error("[seed] error:", error)
    return NextResponse.json({ error: "Failed to seed default mates" }, { status: 500 })
  }
}
