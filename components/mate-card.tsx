"use client"

import type { Mate } from "@/lib/types"
import { MateAvatar } from "./avatar"
import { LevelBadge } from "./level-badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play } from "lucide-react"
import { cn } from "@/lib/utils"

interface MateCardProps {
  mate: Mate
  onOpen: () => void
  onLaunch: () => void
  className?: string
}

export function MateCard({ mate, onOpen, onLaunch, className }: MateCardProps) {
  const statusColors: Record<string, string> = {
    idle: "bg-green-500",
    working: "bg-amber-500 animate-pulse",
    awaiting_user: "bg-blue-500",
    off_duty: "bg-muted-foreground",
  }

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all hover:border-foreground/20 hover:shadow-md",
        className
      )}
      onClick={onOpen}
    >
      <CardContent className="flex h-full flex-col p-4">
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
            <p className="text-xs capitalize text-muted-foreground">{mate.archetype}</p>
            <p className="mt-1 text-sm text-foreground/80">{mate.tagline}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">
            {mate.episode_count} {mate.episode_count === 1 ? "run" : "runs"}
          </span>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onLaunch()
            }}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Launch
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
