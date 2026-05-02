"use client"

import type { Mate } from "@/lib/types"
import { MateAvatar } from "./avatar"
import { ExperienceBar } from "./experience-bar"
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
    <div className={cn("group relative h-full", className)}>
      {/* Offset shadow plate (rounded) sits behind the square card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 translate-x-[6px] translate-y-[6px] rounded-none bg-foreground transition-transform duration-150 group-hover:translate-x-[4px] group-hover:translate-y-[4px] group-active:translate-x-[2px] group-active:translate-y-[2px]"
      />
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter") onOpen()
        }}
        className="relative h-full cursor-pointer rounded-none border-2 border-foreground bg-card text-left transition-transform duration-150 group-hover:translate-x-[2px] group-hover:translate-y-[2px] group-active:translate-x-[4px] group-active:translate-y-[4px]"
      >
        <div className="flex h-full flex-col p-5">
          <div className="flex items-start gap-4">
            <MateAvatar name={mate.name} color={mate.color} size="lg" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-semibold tracking-tight text-foreground">
                {mate.name}
              </h3>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
                {mate.archetype}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                {mate.tagline}
              </p>
            </div>
          </div>
          <ExperienceBar experience={mate.experience ?? 0} className="mt-4" />

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-foreground/15 pt-4">
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
              className="rounded-lg border-2 border-foreground"
            >
              <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
              Launch
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
