"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MateAvatar } from "./avatar"
import { LevelBadge } from "./level-badge"
import { Loader2, Plus, Check } from "lucide-react"
import type { Mate } from "@/lib/types"

interface ForgeFlowProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDescription?: string
  onComplete?: (mate: Mate) => void
}

const EXAMPLES: { label: string; description: string }[] = [
  {
    label: "📩 Brief my inbox",
    description:
      "Quick triage of my Gmail: group the last 24-48h into urgent, FYI, and promo. Read-only.",
  },
  {
    label: "📅 Today's meetings",
    description:
      "Brief me on today's Google Calendar with times, attendees, and a one-line prep note per meeting.",
  },
  {
    label: "✍️ Draft pending replies",
    description:
      "Find emails sent to me that are waiting on a reply (>1 day) and draft a short response for each. Don't send.",
  },
  {
    label: "🗓️ Find a 30-min slot",
    description:
      "Find free 30-min slots on my calendar in the next 5 business days, 9am-6pm local.",
  },
  {
    label: "🎯 Block focus time",
    description:
      "Each weekday morning, block 90 min of 'Deep Focus' on my Google Calendar before the first meeting.",
  },
  {
    label: "🔍 Quick web answer",
    description:
      "When I ask a question, search the web and return a short paragraph synthesis with sources.",
  },
]

export function ForgeFlow({ open, onOpenChange, initialDescription = "", onComplete }: ForgeFlowProps) {
  const [description, setDescription] = useState(initialDescription)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Partial<Mate> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleForge = async () => {
    if (!description.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      })

      if (!res.ok) {
        throw new Error("Failed to forge mate")
      }

      const data = await res.json()
      setResult(data.mate)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = () => {
    if (result) {
      onComplete?.(result as Mate)
      onOpenChange(false)
      // Reset state
      setDescription("")
      setResult(null)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setDescription(initialDescription)
    setResult(null)
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-foreground/80" />
            New agent
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Describe one action your mate should do
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Delete promotional emails older than 7 days from my Gmail inbox."
                rows={4}
                className="resize-none"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                One mate, one action. Keep it specific and repeatable.
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Or pick an example
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => setDescription(ex.description)}
                    className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-foreground/80 transition-colors hover:bg-secondary"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleForge} disabled={loading || !description.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-4 rounded-lg border border-border bg-secondary/30 p-4">
              <MateAvatar
                name={result.name!}
                color={result.color!}
                size="lg"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">{result.name}</h3>
                  <LevelBadge level={1} />
                </div>
                <p className="text-sm capitalize text-muted-foreground">{result.archetype}</p>
                <p className="mt-1 text-sm text-foreground/80">{result.tagline}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="mb-1 text-sm font-medium text-foreground">Voice</h4>
                <p className="text-sm capitalize text-muted-foreground">
                  {result.voice?.register}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {result.voice?.signature_phrases.map((phrase, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                    >
                      {phrase}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-1 text-sm font-medium text-foreground">Tools</h4>
                <div className="flex flex-wrap gap-1">
                  {result.tools?.map((tool, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {tool.mcp_server}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-1 text-sm font-medium text-foreground">Confidence Threshold</h4>
                <p className="text-sm text-muted-foreground">
                  {Math.round((result.confidence_threshold ?? 0.7) * 100)}%
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={() => setResult(null)}>
                Try Again
              </Button>
              <Button onClick={handleAccept}>
                <Check className="mr-2 h-4 w-4" />
                Accept & Recruit
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
