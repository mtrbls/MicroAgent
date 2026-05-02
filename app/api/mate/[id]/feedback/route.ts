import { NextResponse } from "next/server"
import { Client } from "@mubit-ai/sdk"
import { sql } from "@/db"
import { getUserId } from "@/lib/auth"

const XP_PER_FEEDBACK = 5
const FIRST_LEVEL_XP = 5
const XP_PER_LEVEL_AFTER = 30

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId()
    const { id } = await params
    const body = (await request.json()) as {
      kind?: "verdict" | "lesson"
      outcome?: "success" | "failure"
      lesson?: string
      reference_id?: string
    }

    const kind = body.kind ?? "verdict"
    const sessionId = `mate-${id}`
    const referenceId = body.reference_id ?? `feedback-${Date.now()}`
    const client = process.env.MUBIT_API_KEY
      ? new Client({ apiKey: process.env.MUBIT_API_KEY })
      : null

    if (kind === "verdict") {
      if (body.outcome !== "success" && body.outcome !== "failure") {
        return NextResponse.json({ error: "Missing outcome" }, { status: 400 })
      }

      // Dedupe by (mate, reference, kind) — one verdict per assistant
      // message id. INSERT...ON CONFLICT lets us short-circuit when the
      // user has already voted on this reference.
      const dedupe = (await sql`
        INSERT INTO feedback_log (mate_id, reference_id, kind)
        VALUES (${id}, ${referenceId}, 'verdict')
        ON CONFLICT (mate_id, reference_id, kind) DO NOTHING
        RETURNING mate_id
      `) as Array<{ mate_id: string }>
      if (dedupe.length === 0) {
        return NextResponse.json({ ok: true, recorded: false, reason: "duplicate" })
      }

      // Both 👍 and 👎 are signals — both bump XP. Level: lvl 1 ends at
      // FIRST_LEVEL_XP, then each subsequent level requires
      // XP_PER_LEVEL_AFTER xp.
      await sql`
        UPDATE mates
        SET experience = COALESCE(experience, 0) + ${XP_PER_FEEDBACK},
            level = CASE
              WHEN COALESCE(experience, 0) + ${XP_PER_FEEDBACK} < ${FIRST_LEVEL_XP} THEN 1
              ELSE FLOOR((COALESCE(experience, 0) + ${XP_PER_FEEDBACK} - ${FIRST_LEVEL_XP}) / ${XP_PER_LEVEL_AFTER}) + 2
            END
        WHERE id = ${id} AND user_id = ${userId}
      `

      if (client) {
        await client.recordOutcome({
          session_id: sessionId,
          agent_id: id,
          reference_id: referenceId,
          outcome: body.outcome,
          signal: body.outcome === "success" ? 1 : -1,
        })
      }
    } else if (kind === "lesson") {
      const text = (body.lesson ?? "").trim()
      if (!text) {
        return NextResponse.json({ error: "Missing lesson" }, { status: 400 })
      }
      if (client) {
        await client.remember({
          session_id: sessionId,
          agent_id: id,
          content: `Lesson: ${text}`,
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
