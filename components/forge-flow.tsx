"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus, Check } from "lucide-react"
import type { Mate } from "@/lib/types"

interface ForgeFlowProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: (mate: Mate) => void
}

type StepKey = "name" | "avatar" | "voice" | "tools" | "prompt" | "save"
type StepState = "pending" | "running" | "done"

const STEPS: { key: StepKey; label: string }[] = [
  { key: "name", label: "Name & archetype" },
  { key: "avatar", label: "Avatar & color" },
  { key: "voice", label: "Voice" },
  { key: "tools", label: "Toolkits" },
  { key: "prompt", label: "System prompt" },
  { key: "save", label: "Saving" },
]

interface ForgeEvent {
  step: StepKey | "done" | "error"
  status: "start" | "done" | "error"
  label?: string
  value?: string
  message?: string
  mate?: Mate
}

export function ForgeFlow({ open, onOpenChange, onComplete }: ForgeFlowProps) {
  const router = useRouter()
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<StepKey, { state: StepState; value?: string }>>({
    name: { state: "pending" },
    avatar: { state: "pending" },
    voice: { state: "pending" },
    tools: { state: "pending" },
    prompt: { state: "pending" },
    save: { state: "pending" },
  })

  const reset = () => {
    setProgress({
      name: { state: "pending" },
      avatar: { state: "pending" },
      voice: { state: "pending" },
      tools: { state: "pending" },
      prompt: { state: "pending" },
      save: { state: "pending" },
    })
    setError(null)
  }

  const handleCreate = async () => {
    if (!description.trim() || loading) return
    setLoading(true)
    reset()
    try {
      const res = await fetch("/api/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      })
      if (!res.ok || !res.body) throw new Error("Failed to start forge")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let createdMate: Mate | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const events = buffer.split("\n\n")
        buffer = events.pop() ?? ""
        for (const block of events) {
          const line = block.trim()
          if (!line.startsWith("data:")) continue
          const json = line.slice("data:".length).trim()
          if (!json) continue
          let event: ForgeEvent
          try {
            event = JSON.parse(json)
          } catch {
            continue
          }
          if (event.step === "error") {
            throw new Error(event.message ?? "Forge failed")
          }
          if (event.step === "done") {
            createdMate = event.mate ?? null
            continue
          }
          const key = event.step as StepKey
          setProgress((p) => ({
            ...p,
            [key]: {
              state: event.status === "done" ? "done" : "running",
              value: event.value ?? p[key]?.value,
            },
          }))
        }
      }

      if (createdMate) {
        onComplete?.(createdMate)
        setDescription("")
        onOpenChange(false)
        router.refresh()
      } else {
        throw new Error("Forge stream ended without a mate")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const showingProgress = loading || STEPS.some((s) => progress[s.key].state !== "pending")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 top-0 left-0 translate-x-0 translate-y-0 h-dvh w-screen max-w-none rounded-none border-0 sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:h-[85dvh] sm:w-[680px] sm:max-w-[92vw] sm:rounded-lg sm:border">
        <DialogHeader className="shrink-0 border-b border-border/30 px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Plus className="h-5 w-5 text-foreground/80" />
            New action
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Describe one specific action your agent should do. We'll forge an
            agent that uses the right MCP tools.
          </p>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Each weekday morning, post yesterday's GitHub commits to my Slack #standup channel."
            rows={6}
            className="resize-none"
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            One agent, one action. The agent will run with sensible defaults
            and never ask for clarification.
          </p>

          {showingProgress && (
            <div className="mt-2 space-y-2 rounded-xl border border-border/50 bg-secondary/40 p-4">
              {STEPS.map((s) => {
                const st = progress[s.key]
                return (
                  <div key={s.key} className="flex items-center gap-3 text-sm">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                      {st.state === "done" ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : st.state === "running" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-foreground/70" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
                      )}
                    </span>
                    <span
                      className={
                        st.state === "pending"
                          ? "text-muted-foreground/60"
                          : "text-foreground"
                      }
                    >
                      {s.label}
                    </span>
                    {st.value && (
                      <span className="ml-auto truncate font-mono text-xs text-foreground/70">
                        {st.value}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/30 bg-background/80 px-6 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || !description.trim()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Forging...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Forge
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
