"use client"

import type { Episode } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

interface EpisodeLogProps {
  episodes: Episode[]
}

const outcomeColors: Record<string, string> = {
  completed_autonomously: "text-green-500",
  completed_with_edits: "text-amber-500",
  queued_for_approval: "text-blue-500",
  rejected: "text-red-500",
  failed: "text-red-500",
}

const outcomeLabels: Record<string, string> = {
  completed_autonomously: "Auto",
  completed_with_edits: "Edited",
  queued_for_approval: "Pending",
  rejected: "Rejected",
  failed: "Failed",
}

export function EpisodeLog({ episodes }: EpisodeLogProps) {
  if (episodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-muted-foreground">No activity yet</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          This mate {"hasn't"} taken any actions
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {episodes.map((episode) => (
        <div
          key={episode.id}
          className="rounded-lg border border-border bg-secondary/30 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="flex-1 text-sm text-foreground">{episode.action_taken}</p>
            <span
              className={cn(
                "flex-shrink-0 text-xs font-medium",
                outcomeColors[episode.outcome]
              )}
            >
              {outcomeLabels[episode.outcome]}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {formatDistanceToNow(new Date(episode.timestamp), { addSuffix: true })}
            </span>
            <span>Conf: {Math.round(episode.confidence * 100)}%</span>
            <span>{episode.duration_ms}ms</span>
          </div>
        </div>
      ))}
    </div>
  )
}
