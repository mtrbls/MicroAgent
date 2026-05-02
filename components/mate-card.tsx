"use client"

import type { Mate } from "@/lib/types"
import { MateAvatar } from "./avatar"
import { LevelBadge } from "./level-badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MateCardProps {
  mate: Mate
  variant?: "full" | "compact"
  onClick?: () => void
  className?: string
}

export function MateCard({ mate, variant = "full", onClick, className }: MateCardProps) {
  const statusColors: Record<string, string> = {
    idle: "bg-green-500",
    working: "bg-amber-500 animate-pulse",
    awaiting_user: "bg-blue-500",
    off_duty: "bg-muted-foreground",
  }

  if (variant === "compact") {
    return (
      <button
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent",
          className
        )}
      >
        <div className="relative">
          <MateAvatar name={mate.name} color={mate.color} size="sm" />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
              statusColors[mate.status]
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-foreground">{mate.name}</span>
            <LevelBadge level={mate.level} />
          </div>
          <p className="truncate text-xs text-muted-foreground">{mate.tagline}</p>
        </div>
      </button>
    )
  }

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:border-foreground/20 hover:shadow-md",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <MateAvatar name={mate.name} color={mate.color} size="md" />
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
                statusColors[mate.status]
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold text-foreground">{mate.name}</h3>
              <LevelBadge level={mate.level} />
            </div>
            <p className="mb-2 text-sm capitalize text-muted-foreground">{mate.archetype}</p>
            <p className="text-sm text-foreground/80">{mate.tagline}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <span>{mate.episode_count} episodes</span>
          <span>Confidence: {Math.round(mate.confidence_threshold * 100)}%</span>
        </div>
      </CardContent>
    </Card>
  )
}
