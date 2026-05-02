"use client"

import { cn } from "@/lib/utils"

const FIRST_LEVEL_XP = 5
const XP_PER_LEVEL_AFTER = 30

export function levelProgress(experience: number) {
  const xp = Math.max(0, Math.floor(experience || 0))
  if (xp < FIRST_LEVEL_XP) {
    return { level: 1, xpInLevel: xp, xpForLevel: FIRST_LEVEL_XP }
  }
  const adjusted = xp - FIRST_LEVEL_XP
  const level = Math.floor(adjusted / XP_PER_LEVEL_AFTER) + 2
  const xpInLevel = adjusted % XP_PER_LEVEL_AFTER
  return { level, xpInLevel, xpForLevel: XP_PER_LEVEL_AFTER }
}

interface ExperienceBarProps {
  experience: number
  className?: string
  /** When true, renders just the bar without the lv / xp labels. */
  compact?: boolean
}

export function ExperienceBar({
  experience,
  className,
  compact,
}: ExperienceBarProps) {
  const { level, xpInLevel, xpForLevel } = levelProgress(experience)
  const progress = xpForLevel === 0 ? 0 : Math.min(1, xpInLevel / xpForLevel)

  const bar = (
    <div className="h-1 w-full overflow-hidden rounded-full border border-foreground/20 bg-muted">
      <div
        className="h-full bg-emerald-500 transition-[width] duration-500"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  )

  if (compact) {
    return <div className={className}>{bar}</div>
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>Lv {level}</span>
        <span className="tabular-nums">
          {xpInLevel}/{xpForLevel} xp
        </span>
      </div>
      {bar}
    </div>
  )
}
