"use client"

import { cn } from "@/lib/utils"

const XP_PER_LEVEL = 30

interface ExperienceBarProps {
  experience: number
  className?: string
}

export function ExperienceBar({ experience, className }: ExperienceBarProps) {
  const xp = Math.max(0, Math.floor(experience || 0))
  const level = Math.floor(xp / XP_PER_LEVEL) + 1
  const xpInLevel = xp % XP_PER_LEVEL
  const progress = Math.min(1, xpInLevel / XP_PER_LEVEL)

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>Lv {level}</span>
        <span className="tabular-nums">
          {xpInLevel}/{XP_PER_LEVEL} xp
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full border border-foreground/20 bg-muted">
        <div
          className="h-full bg-foreground transition-[width] duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}
