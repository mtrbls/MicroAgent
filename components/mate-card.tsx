"use client"

import type { Mate } from "@/lib/types"
import { MateAvatar } from "./avatar"
import { LevelBadge } from "./level-badge"
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
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen()
      }}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-2xl border border-border/50 bg-card text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-lg",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full opacity-30 blur-3xl transition-opacity group-hover:opacity-50"
        style={{ background: mate.color }}
      />

      <div className="relative flex h-full flex-col p-5">
        <div className="flex items-start gap-4">
          <MateAvatar name={mate.name} color={mate.color} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-semibold tracking-tight text-foreground">
                {mate.name}
              </h3>
              <LevelBadge level={mate.level} />
            </div>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
              {mate.archetype}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              {mate.tagline}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2 pt-4">
          <span className="text-xs text-muted-foreground">
            {mate.episode_count === 0
              ? "Not run yet"
              : `${mate.episode_count} ${mate.episode_count === 1 ? "run" : "runs"}`}
          </span>
          <Button
            size="sm"
            className="rounded-full"
            onClick={(e) => {
              e.stopPropagation()
              onLaunch()
            }}
          >
            <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
            Launch
          </Button>
        </div>
      </div>
    </div>
  )
}
