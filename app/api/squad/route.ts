import { sql, DEFAULT_USER_ID } from "@/db"
import type { Mate } from "@/lib/types"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const mates = await sql`
      SELECT * FROM mates 
      WHERE user_id = ${DEFAULT_USER_ID} AND is_recruited = true
      ORDER BY on_active_squad DESC, name ASC
    `

    const activeSquad = mates.filter((m) => m.on_active_squad)
    const bench = mates.filter((m) => !m.on_active_squad)

    // Get roster (not yet recruited)
    const roster = await sql`
      SELECT * FROM mates 
      WHERE user_id = ${DEFAULT_USER_ID} AND is_recruited = false
      ORDER BY name ASC
    `

    return NextResponse.json({
      activeSquad: activeSquad.map(mapMate),
      bench: bench.map(mapMate),
      roster: roster.map(mapMate),
    })
  } catch (error) {
    console.error("Error fetching squad:", error)
    return NextResponse.json({ error: "Failed to fetch squad" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { action, mateId, inId, outId } = await request.json()

    switch (action) {
      case "recruit": {
        await sql`
          UPDATE mates 
          SET is_recruited = true 
          WHERE id = ${mateId} AND user_id = ${DEFAULT_USER_ID}
        `
        break
      }
      case "promote": {
        // Check if squad is full (6 max)
        const activeCount = await sql`
          SELECT COUNT(*) as count FROM mates 
          WHERE user_id = ${DEFAULT_USER_ID} AND on_active_squad = true
        `
        if (Number(activeCount[0].count) >= 6) {
          return NextResponse.json({ error: "Squad is full (max 6)" }, { status: 400 })
        }
        await sql`
          UPDATE mates 
          SET on_active_squad = true 
          WHERE id = ${mateId} AND user_id = ${DEFAULT_USER_ID}
        `
        break
      }
      case "demote": {
        await sql`
          UPDATE mates 
          SET on_active_squad = false 
          WHERE id = ${mateId} AND user_id = ${DEFAULT_USER_ID}
        `
        break
      }
      case "swap": {
        await sql`UPDATE mates SET on_active_squad = false WHERE id = ${outId}`
        await sql`UPDATE mates SET on_active_squad = true WHERE id = ${inId}`
        break
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating squad:", error)
    return NextResponse.json({ error: "Failed to update squad" }, { status: 500 })
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
