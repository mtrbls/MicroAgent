"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus } from "lucide-react"
import type { Mate } from "@/lib/types"

interface ForgeFlowProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: (mate: Mate) => void
}

export function ForgeFlow({ open, onOpenChange, onComplete }: ForgeFlowProps) {
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!description.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      })
      if (!res.ok) throw new Error("Failed to create action")
      const data = await res.json()
      onComplete?.(data.mate as Mate)
      setDescription("")
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 top-0 left-0 translate-x-0 translate-y-0 h-dvh w-screen max-w-none rounded-none border-0 sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:h-[85dvh] sm:w-[680px] sm:max-w-[92vw] sm:rounded-lg sm:border">
        <DialogHeader className="shrink-0 border-b border-border/30 px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Plus className="h-5 w-5 text-foreground/80" />
            New action
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Describe one specific action your agent should perform. Keep it
            repeatable, with clear defaults.
          </p>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Each morning, archive any Gmail message in the Promotions tab older than 3 days."
            rows={6}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            One agent, one action. The agent will run with sensible defaults
            and never ask for clarification.
          </p>
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/30 bg-background/80 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || !description.trim()}>
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
      </DialogContent>
    </Dialog>
  )
}
