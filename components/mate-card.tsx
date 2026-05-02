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
        "group relative cursor-pointer border-2 border-foreground bg-white text-left transition-transform duration-150",
        "shadow-[6px_6px_0_0_var(--color-foreground)]",
        "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0_0_var(--color-foreground)]",
        "active:translate-x-[4px] active:translate-y-[4px] active:shadow-[2px_2px_0_0_var(--color-foreground)]",
        className
      )}
    >
      <div className="flex h-full flex-col p-5">
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

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-foreground/15 pt-4">
          <span className="text-xs text-muted-foreground">
            {mate.episode_count === 0
              ? "Not run yet"
              : `${mate.episode_count} ${mate.episode_count === 1 ? "run" : "runs"}`}
          </span>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onLaunch()
            }}
            className="rounded-none border-2 border-foreground"
          >
            <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
            Launch
          </Button>
        </div>
      </div>
    </div>
  )
}
