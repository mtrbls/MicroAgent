import { NextResponse } from "next/server"
import { Client } from "@mubit-ai/sdk"
import { sql, DEFAULT_USER_ID } from "@/db"

const XP_PER_FEEDBACK = 5
const XP_PER_LEVEL = 30

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = (await request.json()) as {
      outcome: "success" | "failure"
      rationale?: string
      reference_id?: string
    }

    // Award XP for any feedback (positive or negative — both are signals).
    // Level is derived: floor(experience / XP_PER_LEVEL) + 1.
    await sql`
      UPDATE mates
      SET experience = COALESCE(experience, 0) + ${XP_PER_FEEDBACK},
          level = FLOOR((COALESCE(experience, 0) + ${XP_PER_FEEDBACK}) / ${XP_PER_LEVEL}) + 1
      WHERE id = ${id} AND user_id = ${DEFAULT_USER_ID}
    `

    if (process.env.MUBIT_API_KEY) {
      const client = new Client({ apiKey: process.env.MUBIT_API_KEY })
      const sessionId = `mate-${id}`
      const referenceId = body.reference_id ?? `feedback-${Date.now()}`

      await client.recordOutcome({
        session_id: sessionId,
        agent_id: id,
        reference_id: referenceId,
        outcome: body.outcome,
        signal: body.outcome === "success" ? 1 : -1,
        rationale: body.rationale,
      })

      if (body.outcome === "failure" && body.rationale && body.rationale.trim()) {
        await client.remember({
          session_id: sessionId,
          agent_id: id,
          content: `Lesson: ${body.rationale.trim()}`,
          intent: "lesson",
        })
      }
    }

    return NextResponse.json({ ok: true, recorded: true })
  } catch (err) {
    console.error("[feedback] failed:", err)
    return NextResponse.json(
      { error: "Failed to record feedback" },
      { status: 500 }
    )
  }
}
