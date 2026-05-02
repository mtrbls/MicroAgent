import { sql, DEFAULT_USER_ID } from "@/db"
import { NextResponse } from "next/server"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const mates = await sql`
      SELECT * FROM mates 
      WHERE id = ${id} AND user_id = ${DEFAULT_USER_ID}
    `

    if (mates.length === 0) {
      return NextResponse.json({ error: "Mate not found" }, { status: 404 })
    }

    const mate = mates[0]

    const episodes = await sql`
      SELECT * FROM episodes 
      WHERE mate_id = ${id}
      ORDER BY timestamp DESC
      LIMIT 20
    `

    const memoryFacts = await sql`
      SELECT * FROM memory_facts 
      WHERE mate_id = ${id}
      ORDER BY last_referenced DESC
      LIMIT 20
    `

    const exemplars = await sql`
      SELECT * FROM exemplars 
      WHERE mate_id = ${id}
      ORDER BY created_at DESC
      LIMIT 10
    `

    return NextResponse.json({
      mate,
      episodes,
      memoryFacts,
      exemplars,
    })
  } catch (error) {
    console.error("Error fetching mate:", error)
    return NextResponse.json({ error: "Failed to fetch mate" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const updates = await request.json()

    for (const [field, raw] of Object.entries(updates)) {
      switch (field) {
        case "name":
          await sql`UPDATE mates SET name = ${raw as string} WHERE id = ${id} AND user_id = ${DEFAULT_USER_ID}`
          break
        case "tagline":
          await sql`UPDATE mates SET tagline = ${raw as string} WHERE id = ${id} AND user_id = ${DEFAULT_USER_ID}`
          break
        case "voice":
          await sql`UPDATE mates SET voice = ${JSON.stringify(raw)} WHERE id = ${id} AND user_id = ${DEFAULT_USER_ID}`
          break
        case "confidence_threshold":
          await sql`UPDATE mates SET confidence_threshold = ${raw as number} WHERE id = ${id} AND user_id = ${DEFAULT_USER_ID}`
          break
        case "status":
          await sql`UPDATE mates SET status = ${raw as string} WHERE id = ${id} AND user_id = ${DEFAULT_USER_ID}`
          break
        case "schedule":
          await sql`UPDATE mates SET schedule = ${raw === null ? null : JSON.stringify(raw)} WHERE id = ${id} AND user_id = ${DEFAULT_USER_ID}`
          break
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating mate:", error)
    return NextResponse.json({ error: "Failed to update mate" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Soft delete - just remove from recruited
    await sql`
      UPDATE mates 
      SET is_recruited = false, on_active_squad = false
      WHERE id = ${id} AND user_id = ${DEFAULT_USER_ID}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error archiving mate:", error)
    return NextResponse.json({ error: "Failed to archive mate" }, { status: 500 })
  }
}
