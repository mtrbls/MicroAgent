"use client"

import type { Mate } from "@/lib/types"
import { MateAvatar } from "./avatar"
import { LevelBadge } from "./level-badge"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface ActiveSquadProps {
  mates: Mate[]
  onMateClick?: (mate: Mate) => void
  onEmptySlotClick?: () => void
}

export function ActiveSquad({ mates, onMateClick, onEmptySlotClick }: ActiveSquadProps) {
  const slots = Array(6).fill(null)
  mates.forEach((mate, i) => {
    if (i < 6) slots[i] = mate
  })

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">Active Squad</h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {slots.map((mate, index) => (
          <button
            key={mate?.id || `empty-${index}`}
            onClick={() => (mate ? onMateClick?.(mate) : onEmptySlotClick?.())}
            className={cn(
              "flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed p-2 transition-colors",
              mate
                ? "border-transparent bg-secondary hover:bg-accent"
                : "border-border hover:border-muted-foreground hover:bg-secondary/50"
            )}
          >
            {mate ? (
              <>
                <MateAvatar shape={mate.avatar_shape} color={mate.color} size="md" />
                <span className="mt-2 truncate text-xs font-medium text-foreground">
                  {mate.name}
                </span>
                <LevelBadge level={mate.level} className="mt-1 scale-90" />
              </>
            ) : (
              <Plus className="h-6 w-6 text-muted-foreground" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
