import { sql, DEFAULT_USER_ID } from "@/db"
import type { Mate } from "@/lib/types"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const rows = await sql`
      SELECT * FROM mates
      WHERE user_id = ${DEFAULT_USER_ID} AND is_recruited = true
      ORDER BY created_at DESC NULLS LAST, name ASC
    `
    return NextResponse.json({ mates: rows.map(mapMate) })
  } catch (error) {
    console.error("Error fetching mates:", error)
    return NextResponse.json({ error: "Failed to fetch mates" }, { status: 500 })
  }
}

function mapMate(row: Record<string, unknown>): Mate {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    archetype: row.archetype as Mate["archetype"],
    avatar_shape: row.avatar_shape as Mate["avatar_shape"],
    color: row.color as string,
    tagline: row.tagline as string,
    voice: row.voice as Mate["voice"],
    system_prompt_template: row.system_prompt_template as string,
    tools: row.tools as Mate["tools"],
    confidence_threshold: row.confidence_threshold as number,
    level: row.level as number,
    episode_count: row.episode_count as number,
    status: row.status as Mate["status"],
    last_active: row.last_active as string,
    on_active_squad: row.on_active_squad as boolean,
    is_recruited: row.is_recruited as boolean,
    created_at: row.created_at as string,
  }
}
